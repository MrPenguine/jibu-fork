import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma.service';
import { VaultService } from '../../../core/encryption/vault.service';
import { ProviderCredentialsResolver } from '../../../core/provider-credentials/provider-credentials.resolver';
import {
  getProviderDefinition,
  PROVIDER_REGISTRY,
} from '../../../core/provider-credentials/provider-registry';

export interface SetProviderCredentialInput {
  secret: string;
}

@Injectable()
export class AdminProviderCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vaultService: VaultService,
    private readonly resolver: ProviderCredentialsResolver,
    private readonly configService: ConfigService,
  ) {}

  async list() {
    const metadata = await this.prisma.providerCredential.findMany({
      where: { scope: 'platform' },
    });
    const metadataByProvider = new Map(metadata.map((entry) => [entry.provider, entry]));

    return Promise.all(
      PROVIDER_REGISTRY.map(async (definition) => {
        const stored = await this.readStored(definition.key);
        const entry = metadataByProvider.get(definition.key);
        const hasEnvFallback = definition.envVars.some((envVar) => Boolean(this.configService.get<string>(envVar)));

        return {
          provider: definition.key,
          label: definition.label,
          status: stored ? 'configured' : hasEnvFallback ? 'env' : 'unset',
          lastTest: entry
            ? {
                status: entry.lastTestStatus,
                message: entry.lastTestMessage,
                testedAt: entry.lastTestedAt,
              }
            : null,
        };
      }),
    );
  }

  async set(provider: string, input: SetProviderCredentialInput, createdById: string) {
    const definition = this.requireProvider(provider);
    const secret = input.secret?.trim();
    if (!secret) throw new BadRequestException('Credential secret is required');

    await this.vaultService.writeSecret('providerCredentials', 'platform', provider, { value: secret });
    this.resolver.invalidate(provider);
    await this.prisma.providerCredential.upsert({
      where: { provider_scope: { provider, scope: 'platform' } },
      create: {
        provider,
        label: definition.label,
        scope: 'platform',
        vaultPath: `providerCredentials/platform/${provider}`,
        createdById,
      },
      update: {
        label: definition.label,
        vaultPath: `providerCredentials/platform/${provider}`,
        createdById,
      },
    });

    return { provider, status: 'configured', label: definition.label };
  }

  async remove(provider: string) {
    this.requireProvider(provider);
    try {
      await this.vaultService.destroySecret('providerCredentials', 'platform', provider);
    } catch (error) {
      const status = (error as { response?: { statusCode?: number } }).response?.statusCode;
      if (status !== 404) throw error;
    }
    this.resolver.invalidate(provider);
    await this.prisma.providerCredential.deleteMany({
      where: { provider, scope: 'platform' },
    });

    return { provider, status: 'unset' };
  }

  async test(provider: string, createdById: string) {
    const definition = this.requireProvider(provider);
    const secret = await this.resolver.getSecret(provider);
    let status: 'ok' | 'error' | 'unsupported' = 'error';
    let message = 'Credential is not configured';

    if (secret && definition.test) {
      try {
        await definition.test(secret);
        status = 'ok';
        message = 'Connection successful';
      } catch (error) {
        message = this.sanitizeTestError(error);
      }
    } else if (secret) {
      status = 'unsupported';
      message = 'Testing is not supported for this provider';
    }

    const testedAt = new Date();
    await this.prisma.providerCredential.upsert({
      where: { provider_scope: { provider, scope: 'platform' } },
      create: {
        provider,
        label: definition.label,
        scope: 'platform',
        vaultPath: `providerCredentials/platform/${provider}`,
        createdById,
        lastTestedAt: testedAt,
        lastTestStatus: status,
        lastTestMessage: message,
      },
      update: {
        lastTestedAt: testedAt,
        lastTestStatus: status,
        lastTestMessage: message,
        ...(createdById ? { createdById } : {}),
      },
    });

    return { provider, status, message, testedAt };
  }

  private async readStored(provider: string): Promise<boolean> {
    const stored = await this.vaultService.readSecret<{ value?: string }>(
      'providerCredentials',
      'platform',
      provider,
    );
    return typeof stored?.value === 'string' && stored.value.length > 0;
  }

  private requireProvider(provider: string) {
    const definition = getProviderDefinition(provider);
    if (!definition) throw new BadRequestException(`Unknown provider: ${provider}`);
    return definition;
  }

  private sanitizeTestError(error: unknown): string {
    const status =
      (error as { status?: number; response?: { status?: number; statusCode?: number } }).status ??
      (error as { response?: { status?: number; statusCode?: number } }).response?.status ??
      (error as { response?: { status?: number; statusCode?: number } }).response?.statusCode;
    if (status === 401 || status === 403) return `Authentication failed (${status})`;
    if (status) return `Provider request failed (${status})`;
    if ((error as { code?: string }).code === 'ECONNABORTED') return 'Provider request timed out';
    return 'Provider request failed';
  }
}
