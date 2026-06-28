import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../core/redis/redis.service';
import { PrismaService } from '../../core/database/prisma.service';

export interface ActiveCall {
  connectionId: string;
  agentId?: string;
  sessionId?: string;
  room?: string;
  startTime: number;
  lastHeartbeat: number;
}

const STALE_AFTER_MS = 5 * 60 * 1000; // mirror ConnectionService 5-minute TTL
const DEFAULT_LIMIT = 10;

/**
 * Enforces the workspace `callConcurrencyLimit` for voice calls and exposes a
 * live "active calls" view. Active calls are tracked in a per-workspace Redis
 * hash (`voice:active:<workspaceId>`) keyed by connection id.
 */
@Injectable()
export class CallConcurrencyService {
  private readonly logger = new Logger(CallConcurrencyService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  private key(workspaceId: string): string {
    return `voice:active:${workspaceId}`;
  }

  async getLimit(workspaceId: string): Promise<number> {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    const settings = (ws?.settings as Record<string, unknown>) || {};
    const limit = Number(settings.callConcurrencyLimit);
    return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT;
  }

  async listActiveCalls(workspaceId: string): Promise<ActiveCall[]> {
    const all = await this.redis.hgetall(this.key(workspaceId));
    const now = Date.now();
    const active: ActiveCall[] = [];
    for (const [connectionId, raw] of Object.entries(all)) {
      try {
        const call = JSON.parse(raw) as ActiveCall;
        if (now - call.lastHeartbeat > STALE_AFTER_MS) {
          await this.redis.hdel(this.key(workspaceId), connectionId);
          continue;
        }
        active.push(call);
      } catch {
        await this.redis.hdel(this.key(workspaceId), connectionId);
      }
    }
    return active;
  }

  /**
   * Try to reserve a slot for a new call. Returns false (and reserves nothing)
   * when the workspace is already at its concurrency limit.
   */
  async tryAcquire(
    workspaceId: string,
    call: Omit<ActiveCall, 'startTime' | 'lastHeartbeat'>,
  ): Promise<{ acquired: boolean; active: number; limit: number }> {
    const limit = await this.getLimit(workspaceId);
    const active = await this.listActiveCalls(workspaceId);
    if (active.length >= limit) {
      this.logger.warn(`Concurrency limit reached for workspace ${workspaceId}: ${active.length}/${limit}`);
      return { acquired: false, active: active.length, limit };
    }
    const now = Date.now();
    const record: ActiveCall = { ...call, startTime: now, lastHeartbeat: now };
    await this.redis.hset(this.key(workspaceId), call.connectionId, JSON.stringify(record));
    return { acquired: true, active: active.length + 1, limit };
  }

  async heartbeat(workspaceId: string, connectionId: string): Promise<void> {
    const raw = await this.redis.hget(this.key(workspaceId), connectionId);
    if (!raw) return;
    try {
      const call = JSON.parse(raw) as ActiveCall;
      call.lastHeartbeat = Date.now();
      await this.redis.hset(this.key(workspaceId), connectionId, JSON.stringify(call));
    } catch {
      /* ignore malformed entry */
    }
  }

  async release(workspaceId: string, connectionId: string): Promise<void> {
    await this.redis.hdel(this.key(workspaceId), connectionId);
  }
}
