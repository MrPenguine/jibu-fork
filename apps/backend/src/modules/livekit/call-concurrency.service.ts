import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../core/redis/redis.service';
import { PrismaService } from '../../core/database/prisma.service';
import { ContactService } from '../../core/contact/contact.service';
import { QueueService } from '../../core/queue/queue.service';

export interface ActiveCall {
  connectionId: string;
  agentId?: string;
  sessionId?: string;
  room?: string;
  phoneNumberId?: string;
  direction?: string;
  callId?: string; // Call.id in Postgres, if one was created for this connection
  startTime: number;
  lastHeartbeat: number;
}

const STALE_AFTER_MS = 5 * 60 * 1000; // mirror ConnectionService 5-minute TTL
const DEFAULT_LIMIT = 10;

// Atomic check-and-reserve: HLEN + HSET in one round trip so two concurrent
// acquires for the same workspace can't both pass the limit check before
// either writes (the bug this replaces — get-then-set is not atomic). HLEN
// counts stale-but-not-yet-evicted entries too, which is an accepted safe
// bias: it can only make the limit look reached slightly early, never let it
// be exceeded.
const ACQUIRE_SCRIPT = `
local n = redis.call('HLEN', KEYS[1])
if n >= tonumber(ARGV[2]) then
  return 0
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
return 1
`;

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
    private readonly contacts: ContactService,
    private readonly queue: QueueService,
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
   *
   * When `agentId` is present, also creates a `Call` row (status: 'ringing')
   * — the durable system-of-record — and stashes its id into the Redis
   * record so `release()` can finalize it later without a second lookup.
   * The Redis reservation and the Call row are not created inside one
   * database transaction (they're two different stores), but the Redis
   * write only happens after the Call row succeeds, and this whole method's
   * caller (`backend_client.py`) already treats any failure here as
   * fail-open — a DB hiccup must never block a call from connecting, it
   * just means that call gets no history row that time.
   */
  async tryAcquire(
    workspaceId: string,
    call: Omit<ActiveCall, 'startTime' | 'lastHeartbeat' | 'callId'> & {
      fromNumber?: string;
      toNumber?: string;
    },
  ): Promise<{ acquired: boolean; active: number; limit: number; callId: string | null }> {
    const limit = await this.getLimit(workspaceId);
    const now = Date.now();

    let callId: string | null = null;
    if (call.agentId) {
      try {
        // Anonymous/no-caller-number calls (e.g. a browser-mic test) stay
        // contact-less — never fabricate an identity, per the Contact model's
        // design intent.
        const contact = call.fromNumber
          ? await this.contacts.resolve(workspaceId, call.fromNumber, 'phone')
          : null;
        const created = await this.prisma.call.create({
          data: {
            workspaceId,
            agentId: call.agentId,
            phoneNumberId: call.phoneNumberId,
            contactId: contact?.id,
            direction: call.direction || 'inbound',
            fromNumber: call.fromNumber,
            toNumber: call.toNumber,
            status: 'ringing',
            startedAt: new Date(now),
          },
        });
        callId = created.id;
      } catch (e) {
        this.logger.error(`Failed to create Call row for workspace ${workspaceId}: ${(e as Error).message}`);
      }
    }

    const record: ActiveCall = {
      connectionId: call.connectionId,
      agentId: call.agentId,
      sessionId: call.sessionId,
      room: call.room,
      phoneNumberId: call.phoneNumberId,
      direction: call.direction,
      callId: callId || undefined,
      startTime: now,
      lastHeartbeat: now,
    };
    const key = this.key(workspaceId);
    const acquired = await this.redis.evalScript<number>(
      ACQUIRE_SCRIPT,
      [key],
      [call.connectionId, String(limit), JSON.stringify(record)],
    );
    const active = await this.redis.hlen(key);
    if (!acquired) {
      this.logger.warn(`Concurrency limit reached for workspace ${workspaceId}: ${active}/${limit}`);
      // The reservation didn't happen — the Call row (if created) has no
      // corresponding live call. Mark it failed rather than leaving a
      // permanently-'ringing' row.
      if (callId) {
        await this.prisma.call.update({ where: { id: callId }, data: { status: 'failed', endedAt: new Date() } }).catch(() => {});
      }
      return { acquired: false, active, limit, callId: null };
    }
    return { acquired: true, active, limit, callId };
  }

  /** Marks a Call row 'in-progress' once the agent session actually starts
   * (confirms audio is flowing, not just that a room was joined). */
  async markInProgress(workspaceId: string, connectionId: string): Promise<void> {
    const raw = await this.redis.hget(this.key(workspaceId), connectionId);
    if (!raw) return;
    try {
      const call = JSON.parse(raw) as ActiveCall;
      if (call.callId) {
        await this.prisma.call.update({ where: { id: call.callId }, data: { status: 'in-progress' } });
      }
    } catch {
      /* ignore malformed entry */
    }
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

  /**
   * Finalizes the Call row (if one exists for this connection) and releases
   * the Redis concurrency slot. `status`/`disconnectReason` let the caller
   * report how the call actually ended; defaults to 'completed' since the
   * precise rang-vs-dropped-vs-completed signal from LiveKit's room-
   * disconnect API isn't wired up yet (flagged as a follow-up, not guessed
   * at here).
   */
  async release(
    workspaceId: string,
    connectionId: string,
    outcome?: { status?: string; disconnectReason?: string },
  ): Promise<void> {
    const raw = await this.redis.hget(this.key(workspaceId), connectionId);
    if (raw) {
      try {
        const call = JSON.parse(raw) as ActiveCall;
        if (call.callId) {
          const endedAt = new Date();
          const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - call.startTime) / 1000));
          const finalized = await this.prisma.call
            .update({
              where: { id: call.callId },
              data: {
                status: outcome?.status || 'completed',
                disconnectReason: outcome?.disconnectReason,
                endedAt,
                durationSeconds,
              },
              select: { contactId: true },
            })
            .catch((e) => {
              this.logger.error(`Failed to finalize Call ${call.callId}: ${(e as Error).message}`);
              return null;
            });

          // Post-call analysis queue (Phase 4) — fire-and-forget, never
          // blocks call teardown. Only meaningful with a resolved Contact
          // (memory has nothing to key off otherwise); a browser-mic test
          // call or an anonymous caller just skips this, same rule Phase 2/3
          // already follow.
          if (finalized?.contactId) {
            this.queue
              .addExtractCallMemoryJob({ callId: call.callId, workspaceId, contactId: finalized.contactId })
              .catch((e) => this.logger.error(`Failed to enqueue post-call analysis for ${call.callId}: ${(e as Error).message}`));
          }
        }
      } catch {
        /* ignore malformed entry */
      }
    }
    await this.redis.hdel(this.key(workspaceId), connectionId);
  }
}
