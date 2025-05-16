import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentService } from './agent.service';
import { AgentServiceFactory } from './agent.factory';
import { LangflowAgentService } from './providers/langflow/langflow-agent.service';
import { LangchainAgentService } from './providers/langchain/langchain-agent.service';
import { IAgentService } from './interfaces/agent.interface';
import { LangchainModule } from './providers/langchain/langchain.module';

@Module({
  imports: [ConfigModule, LangchainModule],
  providers: [
    AgentService,
    AgentServiceFactory,
    LangflowAgentService,
    {
      provide: IAgentService,
      useExisting: AgentService
    }
  ],
  exports: [AgentService, IAgentService]
})
export class AgentModule {}
