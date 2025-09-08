import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { N8nIntegrationService } from './n8n-integration.service';
import { N8nWorkerConfig } from './n8n-worker.config';
import { N8nWorkflowProcessor } from './n8n-workflow.processor';
import { N8nAdminClient } from './n8n-admin.client';
import { PublishWorkflowProcessor } from './publish-workflow.processor';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [N8nIntegrationService, N8nWorkerConfig, N8nWorkflowProcessor, N8nAdminClient, PublishWorkflowProcessor],
  exports: [N8nIntegrationService, N8nWorkerConfig, N8nAdminClient],
})
export class N8nModule {}
