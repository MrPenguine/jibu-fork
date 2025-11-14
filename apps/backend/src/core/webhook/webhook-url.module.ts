import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhookUrlService } from './webhook-url.service';
import { WebhookCacheService, REDIS_SERVICE_TOKEN } from '@jibu/cache-utils';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

@Module({
  imports: [ConfigModule],
  providers: [
    WebhookUrlService,
    WebhookCacheService,
    PrismaService,
    RedisService,
    // Bind shared Redis token to the concrete RedisService in backend
    { provide: REDIS_SERVICE_TOKEN, useExisting: RedisService },
  ],
  exports: [WebhookUrlService, WebhookCacheService],
})
export class WebhookUrlModule {}
