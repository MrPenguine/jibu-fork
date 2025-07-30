import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../../core/database/prisma.module';
import { RedisModule } from '../../../core/redis/redis.module';
import { ToolsModule } from '../tools/tools.module';
import { AssistantsModule } from '../assistants/assistants.module';
import { ChatsModule } from '../chats/chats.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { N8nIntegrationModule } from '../../../integrations/n8n/n8n-integration.module';
import { N8nOrchestratorModule } from '../../../core/n8n-orchestrator/n8n-orchestrator.module';
import { AgentController } from './controllers/agent.controller';
import { AgentService as ModuleAgentService } from './services/agent.service';
import { AgentExecutionService } from './execution/agent-execution.service';
import { AgentService as IntegrationsAgentService } from '../../../integrations/agent/agent.service';
import { LangchainAgentService } from '../../../integrations/agent/providers/langchain/langchain-agent.service';
import { RagService } from '../../../integrations/agent/providers/langchain/rag.service';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
    RedisModule,
    ChatsModule,
    forwardRef(() => ToolsModule),
    forwardRef(() => AssistantsModule),
    WorkflowModule,
    N8nIntegrationModule,
    N8nOrchestratorModule,
  ],
  controllers: [AgentController],
  providers: [
    ModuleAgentService,
    IntegrationsAgentService,
    LangchainAgentService,
    RagService,
    AgentExecutionService
  ],
  exports: [
    ModuleAgentService,
    IntegrationsAgentService,
    LangchainAgentService,
    RagService,
    AgentExecutionService
  ],
})
export class AgentModule {}