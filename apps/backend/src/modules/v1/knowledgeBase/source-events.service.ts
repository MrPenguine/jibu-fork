import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { RedisService } from '../../../core/redis/redis.service';
import {
  kbEventsChannel,
  sourceEventIndexingStatus,
  SourceEvent,
  SourceEventStage,
} from '@jibu/queue-definitions';

type EventSource = {
  id: string;
  knowledgeBaseId: string;
  workspaceId: string;
};

@Injectable()
export class SourceEventsService {
  private readonly logger = new Logger(SourceEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  duplicateRedis() {
    return this.redis.duplicate();
  }

  async listForKnowledgeBase(
    knowledgeBaseId: string,
    workspaceId: string,
    options: { since?: Date; sourceId?: string; limit?: number } = {},
  ) {
    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, workspaceId },
      select: { id: true },
    });
    if (!knowledgeBase) return null;

    const events = await this.prisma.knowledgeBaseSourceEvent.findMany({
      where: {
        workspaceId,
        ...(options.sourceId ? { sourceId: options.sourceId } : {}),
        ...(options.since ? { createdAt: { gt: options.since } } : {}),
        source: { knowledgeBaseId },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(options.limit || 200, 1), 200),
    });
    return events.reverse().map((event) => ({
      ...event,
      knowledgeBaseId,
      progress: event.progress ?? null,
      meta: (event.meta as Record<string, unknown> | null) || null,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  async emit(
    source: EventSource,
    stage: SourceEventStage,
    message: string,
    opts: {
      progress?: number;
      meta?: Record<string, unknown>;
      level?: 'info' | 'warn' | 'error';
    } = {},
  ): Promise<SourceEvent | null> {
    try {
      const level = opts.level || (stage === 'FAILED' ? 'error' : 'info');
      const event = await this.prisma.knowledgeBaseSourceEvent.create({
        data: {
          sourceId: source.id,
          workspaceId: source.workspaceId,
          stage,
          level,
          message,
          progress: opts.progress,
          meta: opts.meta as any,
        },
      });
      const sourceUpdate: Record<string, unknown> = {
        indexingStatus: sourceEventIndexingStatus(stage),
      };
      if (opts.progress !== undefined) sourceUpdate.progress = opts.progress;
      if (opts.meta?.chunkCount !== undefined) sourceUpdate.chunkCount = Number(opts.meta.chunkCount);
      if (stage === 'FAILED') sourceUpdate.lastError = message;
      if (stage === 'QUEUED' || stage === 'COMPLETED') sourceUpdate.lastError = null;
      if (stage === 'COMPLETED') sourceUpdate.hasIndexedContent = true;
      if (stage === 'DEINDEXED') sourceUpdate.hasIndexedContent = false;
      await this.prisma.knowledgeBaseSource.update({
        where: { id: source.id },
        data: sourceUpdate as any,
      });

      const fullEvent: SourceEvent = {
        id: event.id,
        sourceId: source.id,
        knowledgeBaseId: source.knowledgeBaseId,
        workspaceId: source.workspaceId,
        stage,
        level,
        message,
        progress: event.progress,
        meta: (event.meta as Record<string, unknown> | null) || null,
        createdAt: event.createdAt.toISOString(),
      };
      await this.redis.publish(kbEventsChannel(source.workspaceId), JSON.stringify(fullEvent));
      return fullEvent;
    } catch (error) {
      this.logger.error(
        `Failed to emit ${stage} event for source ${source.id}: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
