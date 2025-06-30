import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { N8nIntegrationService } from './n8n-integration.service';
import { N8nOrchestratorModule } from '../../core/n8n-orchestrator/n8n-orchestrator.module';

/**
 * Module for n8n integration
 * This module provides services for integrating with n8n
 */
@Module({
  imports: [
    ConfigModule,
    N8nOrchestratorModule,
  ],
  providers: [
    N8nIntegrationService,
  ],
  exports: [
    N8nIntegrationService,
  ],
})
export class N8nIntegrationModule {}
