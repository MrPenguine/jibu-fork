import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { auth } from '../../../core/auth/auth';
import { PrismaService } from '../../../core/database/prisma.service';
import { VaultService } from '../../../core/encryption/vault.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

interface KeyMetadata {
  createdByUserId?: string;
  scopes?: string[];
}

interface ApiKeyRequest {
  apiKey?: unknown;
  session?: { session?: { createdAt?: Date | string } };
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

const revealFailures = new Map<string, { count: number; resetAt: number }>();
// This limiter is process-local; a distributed deployment needs shared storage.

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly vaultService: VaultService,
    private readonly prisma: PrismaService,
  ) {}

  async createApiKey(body: CreateApiKeyDto, workspaceId: string, userId: string, headers: Headers) {
    const created = await auth.api.createApiKey({
      body: {
        organizationId: workspaceId,
        name: body.name,
        expiresIn: body.expiresIn,
        metadata: { createdByUserId: userId, scopes: body.scopes || [] },
      },
      headers,
    });
    try {
      await this.vaultService.writeSecret(
        'apiKeys', workspaceId, created.id, { apiKey: created.key }, workspaceId,
      );
    } catch {
      await auth.api.deleteApiKey({ body: { keyId: created.id }, headers }).catch(() => undefined);
      throw new ConflictException('The API key could not be stored securely');
    }
    return {
      id: created.id,
      name: created.name,
      prefix: created.prefix,
      start: created.start,
      expiresAt: created.expiresAt,
      apiKey: created.key,
    };
  }

  async listApiKeys(workspaceId: string) {
    const keys = await this.prisma.authApiKey.findMany({
      where: { referenceId: workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((key) => this.toPublicKey(key));
  }

  async getApiKey(id: string, workspaceId: string) {
    return this.toPublicKey(await this.findKey(id, workspaceId));
  }

  async revealApiKey(
    id: string,
    workspaceId: string,
    userId: string,
    password: string | undefined,
    request: ApiKeyRequest,
  ) {
    const key = await this.prisma.authApiKey.findUnique({ where: { id } });
    const ownedKey = key?.referenceId === workspaceId ? key : null;
    const details = this.requestDetails(request);
    const audit = (outcome: string) => this.prisma.adminAuditLog.create({
      data: {
        adminUserId: userId,
        action: 'REVEAL_API_KEY',
        targetType: 'ApiKey',
        targetId: id,
        details: { outcome, ip: details.ipAddress, userAgent: details.userAgent },
        ipAddress: details.ipAddress,
        userAgent: details.userAgent,
      },
    });

    if (request.apiKey) {
      await audit('rejected_api_key_auth');
      throw new ForbiddenException('API key reveal requires a fresh session');
    }
    if (!ownedKey) {
      await audit('not_found');
      throw new NotFoundException('API key not found');
    }
    if (!password) {
      await audit('missing_password');
      throw new ForbiddenException('Password is required');
    }
    const now = Date.now();
    for (const [failedUserId, failure] of revealFailures) {
      if (failure.resetAt <= now) revealFailures.delete(failedUserId);
    }
    const failures = revealFailures.get(userId);
    if (failures && failures.resetAt > now && failures.count >= 5) {
      await audit('rate_limited');
      throw new HttpException('Too many failed password attempts', 429);
    }
    const createdAt = request.session?.session?.createdAt;
    if (!createdAt || now - new Date(createdAt).getTime() > 3600 * 1000) {
      await audit('stale_session');
      throw new ForbiddenException('Please re-authenticate before revealing an API key');
    }

    const account = await this.prisma.authAccount.findFirst({
      where: { userId, providerId: 'credential' },
      select: { password: true },
    });
    const validPassword = Boolean(account?.password) &&
      await (await auth.$context).password.verify({
        hash: account?.password || '',
        password,
      });
    if (!validPassword) {
      const current = failures && failures.resetAt > now
        ? failures
        : { count: 0, resetAt: now + 15 * 60 * 1000 };
      current.count += 1;
      revealFailures.set(userId, current);
      await audit('invalid_password');
      throw new ForbiddenException('Invalid password');
    }

    const secret = await this.vaultService.readSecret<{ apiKey?: string }>(
      'apiKeys', workspaceId, id, workspaceId,
    );
    if (!secret?.apiKey) {
      await audit('plaintext_unavailable');
      throw new ConflictException('The API key plaintext is unavailable');
    }
    revealFailures.delete(userId);
    await audit('success');
    return { id, apiKey: secret.apiKey };
  }

  async rotateApiKey(id: string, workspaceId: string, userId: string, headers: Headers) {
    const oldKey = await this.findKey(id, workspaceId);
    const metadata = this.parseMetadata(oldKey.metadata);
    const created = await auth.api.createApiKey({
      body: {
        organizationId: workspaceId,
        name: oldKey.name || 'API key',
        expiresIn: oldKey.expiresAt
          ? Math.max(1, Math.ceil((oldKey.expiresAt.getTime() - Date.now()) / 1000))
          : null,
        metadata: { ...metadata, createdByUserId: metadata.createdByUserId || userId },
      },
      headers,
    });
    let oldPluginRemoved = false;
    try {
      await this.vaultService.writeSecret(
        'apiKeys', workspaceId, created.id, { apiKey: created.key }, workspaceId,
      );
      await auth.api.updateApiKey({ body: { keyId: id, enabled: false }, headers });
      await auth.api.deleteApiKey({ body: { keyId: id }, headers });
      oldPluginRemoved = true;
      await this.vaultService.deleteSecret('apiKeys', workspaceId, id, workspaceId);
    } catch {
      if (!oldPluginRemoved) {
        await this.vaultService.deleteSecret(
          'apiKeys', workspaceId, created.id, workspaceId,
        ).catch(() => undefined);
        await auth.api.deleteApiKey({ body: { keyId: created.id }, headers }).catch(() => undefined);
      }
      throw new ConflictException('The API key could not be rotated securely');
    }
    return { id: created.id, name: created.name, prefix: created.prefix, apiKey: created.key };
  }

  async revokeApiKey(id: string, workspaceId: string, headers: Headers) {
    await this.findKey(id, workspaceId);
    await auth.api.updateApiKey({ body: { keyId: id, enabled: false }, headers });
    try {
      await this.vaultService.deleteSecret('apiKeys', workspaceId, id, workspaceId);
    } catch {
      throw new ConflictException('The API key was disabled but its plaintext could not be removed');
    }
    return { id, enabled: false };
  }

  async deleteApiKey(id: string, workspaceId: string, headers: Headers) {
    await this.findKey(id, workspaceId);
    await auth.api.deleteApiKey({ body: { keyId: id }, headers });
    try {
      await this.vaultService.deleteSecret('apiKeys', workspaceId, id, workspaceId);
    } catch {
      throw new ConflictException('The API key was deleted but its plaintext could not be removed');
    }
    return { id };
  }

  private async findKey(id: string, workspaceId: string) {
    const key = await this.prisma.authApiKey.findUnique({ where: { id } });
    if (!key || key.referenceId !== workspaceId) throw new NotFoundException('API key not found');
    return key;
  }

  private toPublicKey(key: {
    id: string; name: string | null; start: string | null; prefix: string | null;
    enabled: boolean; expiresAt: Date | null; createdAt: Date; lastRequest: Date | null;
    metadata: string | null;
  }) {
    const metadata = this.parseMetadata(key.metadata);
    return {
      id: key.id, name: key.name, start: key.start, prefix: key.prefix, enabled: key.enabled,
      expiresAt: key.expiresAt, createdAt: key.createdAt, lastRequest: key.lastRequest,
      scopes: metadata.scopes || [],
    };
  }

  private parseMetadata(metadata: string | null): KeyMetadata {
    if (!metadata) return {};
    try {
      const parsed: unknown = JSON.parse(metadata);
      if (!parsed || typeof parsed !== 'object') return {};
      const record = parsed as Record<string, unknown>;
      return {
        createdByUserId: typeof record.createdByUserId === 'string' ? record.createdByUserId : undefined,
        scopes: Array.isArray(record.scopes)
          ? record.scopes.filter((scope): scope is string => typeof scope === 'string')
          : [],
      };
    } catch { return {}; }
  }

  private requestDetails(request: ApiKeyRequest) {
    const forwarded = request.headers['x-forwarded-for'];
    const ipAddress = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0]?.trim() || request.ip;
    const userAgent = request.headers['user-agent'];
    return {
      ipAddress,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }
}
