import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { N8nIntegrationService } from './n8n-integration.service';
import { N8nWorkerConfig } from './n8n-worker.config';
import { N8nWorkflowProcessor } from './n8n-workflow.processor';
import { N8nAdminClient } from './n8n-admin.client';
import { PublishWorkflowProcessor } from './publish-workflow.processor';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor';
import { DatabaseModule } from '../../../backend/src/core/database/database.module';
import { WebhookCacheService, REDIS_SERVICE_TOKEN, IRedisService } from '@jibu/cache-utils';
import { RedisService } from '../../../backend/src/core/redis/redis.service';
import { WebhookUrlService } from '../../../backend/src/core/webhook/webhook-url.service';

@Module({
  imports: [
    DatabaseModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [
    N8nIntegrationService, 
    N8nWorkerConfig, 
    N8nWorkflowProcessor, 
    N8nAdminClient, 
    PublishWorkflowProcessor,
    WebhookDeliveryProcessor,
    RedisService,
    WebhookUrlService,
    // Bind shared Redis token to the concrete RedisService in worker
    { provide: REDIS_SERVICE_TOKEN, useExisting: RedisService },
    {
      provide: WebhookCacheService,
      useFactory: (redisService: IRedisService) => new WebhookCacheService(redisService),
      inject: [REDIS_SERVICE_TOKEN],
    },
  ],
  exports: [N8nIntegrationService, N8nWorkerConfig, N8nAdminClient, WebhookCacheService],
})
export class N8nModule {}
