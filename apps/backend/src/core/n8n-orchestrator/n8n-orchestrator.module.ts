import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { N8nClient } from './n8n-client';
import { N8nOrchestratorService } from './n8n-orchestrator.service';
import { N8nWorkflowService } from './n8n-workflow.service';
import { N8nNodeService } from './n8n-node.service';
import { N8nConnectionService } from './n8n-connection.service';

/**
 * Module for n8n orchestration
 * This module provides services for interacting with n8n
 */
@Module({
  imports: [ConfigModule],
  providers: [
    N8nClient,
    N8nOrchestratorService,
    N8nWorkflowService,
    N8nNodeService,
    N8nConnectionService,
  ],
  exports: [
    N8nClient,
    N8nOrchestratorService,
    N8nWorkflowService,
    N8nNodeService,
    N8nConnectionService,
  ],
})
export class N8nOrchestratorModule {}
