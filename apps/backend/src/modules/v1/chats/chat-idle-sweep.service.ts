import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../../core/database/prisma.service';
import { QueueService } from '../../../core/queue/queue.service';

const WARN_AFTER_MS = 60_000;
const TERMINATE_AFTER_MS = 120_000; // total elapsed since lastUserMessageAt, not "1 min after the warn fired"
const SWEEP_INTERVAL_MS = 15_000;
const BATCH_SIZE = 100;

/**
 * Periodic idle-timeout sweep for chat sessions — chat is plain REST/poll (no
 * WebSocketGateway anywhere in this backend), so there's no live connection to
 * hang a per-session timer off. Matches the existing @Interval convention
 * (VoicesService, PhoneNumberService) rather than a new BullMQ repeatable-job
 * pattern, which has no precedent here.
 *
 * Both passes key off the single Chat.lastUserMessageAt column with two
 * cutoffs (60s, 120s) rather than a separate "warned at" timestamp — avoids a
 * JSON-path range filter on Chat.metadata, which nothing in this codebase
 * does today. A role:'user' message resets status back to 'active'
 * (ChatsService.createMessage), which re-arms a fresh warn/terminate cycle on
 * the next lull instead of jumping straight to termination.
 *
 * Scoped to sessionType: 'chat' only — WhatsApp threads (sessionType:
 * 'whatsapp') must never get an injected "are you still there?" message.
 */
@Injectable()
export class ChatIdleSweepService {
  private readonly logger = new Logger(ChatIdleSweepService.name);
  // @Interval fires on a fixed schedule regardless of whether the previous
  // tick has finished — verified live: without this guard, a slow first
  // tick (cold Prisma connection) let a second tick start before the first
  // tick's status update committed, and both inserted a warning message for
  // the same chat. A simple in-flight flag is the standard fix.
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  @Interval(SWEEP_INTERVAL_MS)
  async sweep() {
    if (this.running) return;
    this.running = true;
    try {
      await this.warnIdleChats();
      await this.terminateIdleChats();
    } catch (e) {
      this.logger.error(`Idle sweep failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async warnIdleChats() {
    const cutoff = new Date(Date.now() - WARN_AFTER_MS);
    const stale = await this.prisma.chat.findMany({
      where: { sessionType: 'chat', status: 'active', lastUserMessageAt: { lt: cutoff } },
      select: { id: true },
      take: BATCH_SIZE,
    });

    for (const { id } of stale) {
      const last = await this.prisma.message.findFirst({ where: { chatId: id }, orderBy: { sequenceId: 'desc' } });
      const nextSeq = (last?.sequenceId ?? -1) + 1;
      await this.prisma
        .$transaction([
          this.prisma.message.create({
            data: { chatId: id, role: 'system', type: 'text', content: 'Are you still there?', sequenceId: nextSeq },
          }),
          this.prisma.chat.update({ where: { id }, data: { status: 'idle_warned' } }),
        ])
        .catch((e) => this.logger.error(`Failed to warn idle chat ${id}: ${(e as Error).message}`));
    }
  }

  private async terminateIdleChats() {
    const cutoff = new Date(Date.now() - TERMINATE_AFTER_MS);
    const stale = await this.prisma.chat.findMany({
      where: { sessionType: 'chat', status: 'idle_warned', lastUserMessageAt: { lt: cutoff } },
      select: { id: true, workspaceId: true, contactId: true },
      take: BATCH_SIZE,
    });

    for (const chat of stale) {
      await this.prisma.chat
        .update({
          where: { id: chat.id },
          data: { status: 'terminated', endedAt: new Date(), disconnectReason: 'idle_timeout' },
        })
        .catch((e) => this.logger.error(`Failed to terminate idle chat ${chat.id}: ${(e as Error).message}`));

      // Only meaningful with a resolved Contact — mirrors
      // CallConcurrencyService.release's exact contactId guard for the call side.
      if (chat.contactId) {
        this.queue
          .addExtractChatMemoryJob({ chatId: chat.id, workspaceId: chat.workspaceId, contactId: chat.contactId })
          .catch((e) => this.logger.error(`Failed to enqueue post-chat analysis for ${chat.id}: ${(e as Error).message}`));
      }
    }
  }
}
