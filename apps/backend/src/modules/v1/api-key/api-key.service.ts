import { Injectable, Logger } from '@nestjs/common';
import { VaultService } from '../../../core/encryption/vault.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { randomUUID, randomBytes } from 'crypto';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);
  
  constructor(
    private readonly vaultService: VaultService,
    private readonly prisma: PrismaService,
  ) {}

  async createApiKey(body: CreateApiKeyDto, orgId: string, userId: string) {
    const { name, scopes } = body;
    const apiKeyId = randomUUID();
    // 1. Generate secure API key
    const apiKey = 'sk_' + randomBytes(32).toString('hex');
    const prefix = apiKey.slice(0, 10);

    // 2. Store full key in Vault
    await this.vaultService.writeSecret('apiKeys', orgId, apiKeyId, { apiKey }, orgId);

    // 3. Store metadata in DB
    const created = await this.prisma.apiKey.create({
      data: {
        id: apiKeyId,
        organizationId: orgId,
        userId,
        name,
        prefix,
        scopes: scopes || [],
      },
    });
    // 4. Return full key only on creation
    return { id: created.id, name: created.name, prefix: created.prefix, apiKey };
  }

  async listApiKeys(orgId: string, userId: string) {
    // 1. Check for default private key
    const defaultPrivate = await this.prisma.apiKey.findFirst({
      where: { organizationId: orgId, name: "Default Private Key" },
    });
    if (!defaultPrivate) {
      await this.createDefaultKey(orgId, userId, "private");
    }
    // 2. Check for default public key
    const defaultPublic = await this.prisma.apiKey.findFirst({
      where: { organizationId: orgId, name: "Default Public Key" },
    });
    if (!defaultPublic) {
      await this.createDefaultKey(orgId, userId, "public");
    }
    // 3. Return all keys for the organization
    return this.prisma.apiKey.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, prefix: true, scopes: true, createdAt: true, revoked: true, lastUsedAt: true },
    });
  }

  // Helper to create a default key
  private async createDefaultKey(orgId: string, userId: string, type: "private" | "public") {
    const apiKeyId = randomUUID();
    const apiKey = 'sk_' + randomBytes(32).toString('hex');
    const prefix = apiKey.slice(0, 10);
    const name = type === "private" ? "Default Private Key" : "Default Public Key";
    await this.vaultService.writeSecret('apiKeys', orgId, apiKeyId, { apiKey }, orgId);
    await this.prisma.apiKey.create({
      data: {
        id: apiKeyId,
        organizationId: orgId,
        userId, // Keep userId for audit purposes only
        name,
        prefix,
        scopes: [],
      },
    });
  }

  async getApiKey(id: string, orgId: string, userId: string) {
    try {
      // 1. Get metadata from DB
      const meta = await this.prisma.apiKey.findUnique({ where: { id } });
      if (!meta) {
        this.logger.warn(`API key with ID ${id} not found in database`);
        return null;
      }
      
      // 2. Get secret from Vault
      try {
        const secret = await this.vaultService.readSecret('apiKeys', orgId, id, orgId);
        return { ...meta, secret };
      } catch (vaultError) {
        this.logger.error(`Failed to retrieve API key secret from vault: ${vaultError.message}`, vaultError.stack);
        // Return metadata without the secret
        return { 
          ...meta, 
          secret: null,
          error: 'Secret retrieval failed. The key exists but the secret could not be accessed.'
        };
      }
    } catch (error) {
      this.logger.error(`Error retrieving API key: ${error.message}`, error.stack);
      throw new Error(`Failed to retrieve API key: ${error.message}`);
    }
  }

  async deleteApiKey(id: string, orgId: string, userId: string) {
    try {
      // 1. Get metadata from DB
      const meta = await this.prisma.apiKey.findUnique({ where: { id } });
      if (!meta) {
        this.logger.warn(`API key with ID ${id} not found in database`);
        return null;
      }
      
      // 2. Delete from Vault
      try {
        await this.vaultService.deleteSecret('apiKeys', orgId, id, orgId);
      } catch (vaultError) {
        this.logger.error(`Failed to delete API key secret from vault: ${vaultError.message}`, vaultError.stack);
        // Continue with DB deletion even if vault deletion fails
        this.logger.warn('Proceeding with database deletion despite vault error');
      }
      
      // 3. Delete metadata from DB
      await this.prisma.apiKey.delete({ where: { id } });
      this.logger.log(`Successfully deleted API key with ID ${id}`);
      return { id };
    } catch (error) {
      this.logger.error(`Error deleting API key: ${error.message}`, error.stack);
      throw new Error(`Failed to delete API key: ${error.message}`);
    }
  }

  async revokeApiKey(id: string, orgId: string, userId: string) {
    try {
      // Check if API key exists
      const apiKey = await this.prisma.apiKey.findUnique({ where: { id } });
      if (!apiKey) {
        this.logger.warn(`API key with ID ${id} not found in database`);
        return null;
      }
      
      // Mark as revoked in DB
      const result = await this.prisma.apiKey.update({
        where: { id },
        data: { revoked: true },
      });
      
      this.logger.log(`Successfully revoked API key with ID ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error revoking API key: ${error.message}`, error.stack);
      throw new Error(`Failed to revoke API key: ${error.message}`);
    }
    // Note: We're not deleting from vault as per the original comment
    // Optionally: await this.vaultService.deleteSecret('apiKeys', orgId, id, orgId);
  }

  async ensureDefaultKeysForUser(orgId: string, userId: string) {
    // Check for default private key
    const defaultPrivate = await this.prisma.apiKey.findFirst({
      where: { organizationId: orgId, name: "Default Private Key" },
    });
    if (!defaultPrivate) {
      await this.createDefaultKey(orgId, userId, "private");
    }
    // Check for default public key
    const defaultPublic = await this.prisma.apiKey.findFirst({
      where: { organizationId: orgId, name: "Default Public Key" },
    });
    if (!defaultPublic) {
      await this.createDefaultKey(orgId, userId, "public");
    }
  }
} 