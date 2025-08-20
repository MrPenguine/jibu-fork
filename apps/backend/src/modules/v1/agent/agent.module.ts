import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../../core/database/prisma.module';
import { RedisModule } from '../../../core/redis/redis.module';
import { AssistantsModule } from '../assistants/assistants.module';
import { ChatsModule } from '../chats/chats.module';
import { WorkflowModule } from '../workflow/workflow.module';


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
    forwardRef(() => AssistantsModule),
    WorkflowModule
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