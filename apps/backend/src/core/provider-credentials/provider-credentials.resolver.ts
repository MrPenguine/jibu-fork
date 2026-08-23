import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VaultService } from '../encryption/vault.service';
import { getProviderDefinition } from './provider-registry';

interface CachedSecret {
  value: string | null;
  expiresAt: number;
}

@Injectable()
export class ProviderCredentialsResolver {
  private readonly logger = new Logger(ProviderCredentialsResolver.name);
  private readonly cache = new Map<string, CachedSecret>();
  private readonly cacheTtlMs = 60_000;

  constructor(
    private readonly vaultService: VaultService,
    private readonly configService: ConfigService,
  ) {}

  async getSecret(provider: string): Promise<string | null> {
    const definition = getProviderDefinition(provider);
    if (!definition) return null;

    const cached = this.cache.get(provider);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let value: string | null = null;
    try {
      const stored = await this.vaultService.readSecret<{ value?: string }>('providerCredentials', 'platform', provider);
      value = typeof stored?.value === 'string' && stored.value.length > 0 ? stored.value : null;
    } catch (error) {
      this.logger.warn(`Unable to read provider credential for ${provider}: ${(error as Error).message}`);
    }

    if (!value) {
      for (const envVar of definition.envVars) {
        const fallback = this.configService.get<string>(envVar);
        if (fallback) {
          value = fallback;
          break;
        }
      }
    }

    this.cache.set(provider, { value, expiresAt: Date.now() + this.cacheTtlMs });
    return value;
  }

  invalidate(provider: string): void {
    this.cache.delete(provider);
  }
}
