import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma.service';
import { RedisService } from '../../../core/redis/redis.service';
import { AdminProviderCredentialsService } from './provider-credentials.service';
import { EMBEDDING_MODELS } from '../../../../../worker/src/embedding/embedding.service';
import * as fs from 'fs';
import * as path from 'path';

type CheckStatus = 'ok' | 'warn' | 'fail' | 'skipped';
type CheckResult = {
  key: string;
  label: string;
  status: CheckStatus;
  message: string;
  latencyMs: number;
  details?: unknown;
};

@Injectable()
export class AdminSystemChecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly credentials: AdminProviderCredentialsService,
  ) {}

  async runAll() {
    const checks = await Promise.all([
      this.run('postgres', 'PostgreSQL', () => this.checkPostgres()),
      this.run('redis', 'Redis', () => this.checkRedis()),
      this.run('qdrant', 'Qdrant', () => this.checkHttp('qdrant', 'Qdrant', this.url('QDRANT_URL', 'http://localhost:6333') + '/collections')),
      this.run('vault', 'Vault', () => this.checkVault()),
      this.run('n8n', 'n8n', () => this.checkHttp('n8n', 'n8n', this.url('N8N_URL', 'http://localhost:5678'))),
      this.run('livekit', 'LiveKit', () => this.checkHttp('livekit', 'LiveKit', this.httpUrl('LIVEKIT_URL', 'http://localhost:7880'))),
      this.run('worker', 'Worker', () => this.checkHttp('worker', 'Worker', this.url('WORKER_API_URL', 'http://localhost:3001'))),
      this.run('ollama', 'Ollama', () => this.checkOllama()),
      this.run('embedding-consistency', 'Embedding consistency', () => this.checkEmbeddingConsistency()),
      this.run('prisma-migrations', 'Prisma migrations', () => this.checkMigrations()),
      this.run('provider-credentials', 'Provider credentials', () => this.checkProviderCredentials()),
    ]);
    const rank: Record<CheckStatus, number> = { ok: 0, skipped: 1, warn: 2, fail: 3 };
    const overall = checks.reduce<CheckStatus>(
      (worst, check) => (rank[check.status] > rank[worst] ? check.status : worst),
      'ok',
    );
    return { status: overall, checks };
  }

  private async run(
    key: string,
    label: string,
    operation: () => Promise<Omit<CheckResult, 'key' | 'label' | 'latencyMs'>>,
  ): Promise<CheckResult> {
    const started = Date.now();
    try {
      const result = await this.withTimeout(operation(), 5000);
      return { key, label, ...result, latencyMs: Date.now() - started };
    } catch (error) {
      return {
        key,
        label,
        status: 'fail',
        message: error instanceof Error ? error.message : 'Check failed',
        latencyMs: Date.now() - started,
      };
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }

  private async checkPostgres() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' as const, message: 'Database query succeeded' };
  }

  private async checkRedis() {
    if (!(await this.redis.ping())) {
      return { status: 'fail' as const, message: 'Redis did not respond to PING' };
    }
    return { status: 'ok' as const, message: 'Redis responded to PING' };
  }

  private async checkVault() {
    const response = await fetch(`${this.httpUrl('VAULT_ADDR', 'http://localhost:8200')}/v1/sys/health`);
    const body = (await response.json().catch(() => ({}))) as { sealed?: boolean; initialized?: boolean };
    if (body.sealed) return { status: 'fail' as const, message: 'Vault is sealed', details: { initialized: body.initialized, sealed: true } };
    if (!response.ok && response.status !== 429) return { status: 'fail' as const, message: `Vault health returned HTTP ${response.status}` };
    return { status: 'ok' as const, message: 'Vault is initialized and unsealed', details: { initialized: body.initialized, sealed: false } };
  }

  private async checkHttp(key: string, label: string, endpoint: string) {
    try {
      const response = await fetch(endpoint);
      return {
        status: 'ok' as const,
        message: `${label} responded with HTTP ${response.status}`,
        details: { reachable: true },
      };
    } catch {
      return {
        status: 'fail' as const,
        message: `${label} is unreachable`,
        details: { reachable: false },
      };
    }
  }

  private async checkOllama() {
    const response = await fetch(`${this.httpUrl('OLLAMA_URL', 'http://localhost:11435')}/api/tags`);
    if (!response.ok) return { status: 'fail' as const, message: `Ollama returned HTTP ${response.status}` };
    const body = (await response.json()) as { models?: Array<{ name?: string }> };
    const model = this.config.get<string>('EMBEDDING_MODEL', 'gemini-embedding-001');
    const present = (body.models || []).some((item) => item.name === model);
    return {
      status: present ? ('ok' as const) : ('warn' as const),
      message: present ? `Configured model ${model} is available` : `Configured model ${model} is not installed`,
      details: { model, modelPresent: present },
    };
  }

  private async checkEmbeddingConsistency() {
    const backendModel = this.config.get<string>('EMBEDDING_MODEL', 'gemini-embedding-001');
    const backendDimension = Number(this.config.get<string>('VECTOR_DIMENSION', '768'));
    const workerModel = this.config.get<string>('WORKER_EMBEDDING_MODEL', 'qwen3-embedding:0.6b');
    const workerDimension = Number(this.config.get<string>('WORKER_VECTOR_DIMENSION', '1024'));
    const knowledgeBases = await this.prisma.knowledgeBase.findMany({
      select: { id: true, name: true, embeddingModel: true },
    });
    const offenders = knowledgeBases
      .filter((kb) => {
        if (!kb.embeddingModel) return true;
        const dimension = EMBEDDING_MODELS[kb.embeddingModel]?.dimension;
        return kb.embeddingModel !== backendModel || (dimension !== undefined && dimension !== backendDimension);
      })
      .map((kb) => ({ id: kb.id, name: kb.name, embeddingModel: kb.embeddingModel || null }));
    const configMismatch = backendModel !== workerModel || backendDimension !== workerDimension;
    const warning = configMismatch || offenders.length > 0;
    return {
      status: warning ? ('warn' as const) : ('ok' as const),
      message: warning ? 'Embedding configuration or stored knowledge bases need attention' : 'Embedding configuration is consistent',
      details: {
        backend: { model: backendModel, dimension: backendDimension },
        worker: { model: workerModel, dimension: workerDimension },
        offendingKnowledgeBases: offenders,
      },
    };
  }

  private async checkMigrations() {
    const migrationsPath = path.resolve(process.cwd(), 'apps/backend/prisma/migrations');
    const directories = fs.readdirSync(migrationsPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const applied = await this.prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>`
      SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"
    `;
    const appliedNames = new Set(applied.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name));
    const unapplied = directories.filter((directory) => !appliedNames.has(directory));
    return {
      status: unapplied.length ? ('warn' as const) : ('ok' as const),
      message: unapplied.length ? `${unapplied.length} migration(s) are unapplied` : 'All Prisma migrations are applied',
      details: { unapplied },
    };
  }

  private async checkProviderCredentials() {
    const providers = await this.credentials.list();
    return {
      status: providers.some((provider) => provider.status === 'unset') ? ('warn' as const) : ('ok' as const),
      message: `${providers.filter((provider) => provider.status === 'configured').length} configured, ${providers.filter((provider) => provider.status === 'env').length} env fallback, ${providers.filter((provider) => provider.status === 'unset').length} unset`,
      details: providers.map((provider) => ({
        provider: provider.provider,
        label: provider.label,
        status: provider.status,
        lastTest: provider.lastTest,
      })),
    };
  }

  private url(key: string, fallback: string) {
    return this.config.get<string>(key) || fallback;
  }

  private httpUrl(key: string, fallback: string) {
    let value = this.url(key, fallback).replace(/^ws(s?):\/\//, 'http$1://').replace(/\/$/, '');
    if (value === 'http://ollama:11434') value = 'http://localhost:11435';
    return value;
  }
}
