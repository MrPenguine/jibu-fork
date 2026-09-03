import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../../backend/src/core/database/prisma.service';
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
export class SourceEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(SourceEventsService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST') || 'localhost',
      port: parseInt(this.configService.get('REDIS_PORT') || '6379', 10),
      password: this.configService.get('REDIS_PASSWORD') || undefined,
    });
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
      const event = await this.prisma.knowledgeBaseSourceEvent.create({
        data: {
          sourceId: source.id,
          workspaceId: source.workspaceId,
          stage,
          level: opts.level || (stage === 'FAILED' ? 'error' : 'info'),
          message,
          progress: opts.progress,
          meta: opts.meta as any,
        },
      });

      const sourceUpdate: Record<string, unknown> = {
        indexingStatus: sourceEventIndexingStatus(stage),
      };
      if (opts.progress !== undefined) sourceUpdate.progress = opts.progress;
      if (opts.meta?.chunkCount !== undefined) {
        sourceUpdate.chunkCount = Number(opts.meta.chunkCount);
      }
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
        level: (opts.level || (stage === 'FAILED' ? 'error' : 'info')) as SourceEvent['level'],
        message,
        progress: event.progress,
        meta: (event.meta as Record<string, unknown> | null) || null,
        createdAt: event.createdAt.toISOString(),
      };
      await this.redis.publish(
        kbEventsChannel(source.workspaceId),
        JSON.stringify(fullEvent),
      );

      const eventCount = await this.prisma.knowledgeBaseSourceEvent.count({
        where: { sourceId: source.id },
      });
      if (eventCount % 50 === 0) {
        const retained = await this.prisma.knowledgeBaseSourceEvent.findMany({
          where: { sourceId: source.id },
          orderBy: { createdAt: 'desc' },
          skip: 200,
          select: { id: true },
        });
        if (retained.length > 0) {
          await this.prisma.knowledgeBaseSourceEvent.deleteMany({
            where: { id: { in: retained.map(({ id }) => id) } },
          });
        }
      }

      return fullEvent;
    } catch (error) {
      this.logger.error(
        `Failed to emit ${stage} event for source ${source.id}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
