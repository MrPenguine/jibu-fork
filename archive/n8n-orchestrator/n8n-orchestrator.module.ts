import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { N8nClient } from './n8n-client';
import { N8nOrchestratorService } from './n8n-orchestrator.service';
import { N8nWorkflowService } from './n8n-workflow.service';
import { N8nNodeService } from './n8n-node.service';
import { N8nConnectionService } from './n8n-connection.service';
import { N8nTemplateService } from './n8n-template.service';
import { PrismaModule } from '../database/prisma.module';

/**
 * Module for n8n orchestration
 * This module provides services for creating, managing, and interacting with n8n workflows.
 */
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    N8nOrchestratorService,
    N8nWorkflowService,
    N8nClient,
    N8nNodeService,
    N8nConnectionService,
    N8nTemplateService,
  ],
  exports: [
    N8nOrchestratorService,
    N8nWorkflowService,
    N8nClient,
    N8nNodeService,
    N8nConnectionService,
    N8nTemplateService,
  ],
})
export class N8nOrchestratorModule {}
