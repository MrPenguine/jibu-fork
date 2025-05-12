import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentService } from './agent.service';
import { AgentServiceFactory } from './agent.factory';
import { LangflowAgentService } from './providers/langflow/langflow-agent.service';
import { IAgentService } from './interfaces/agent.interface';

@Module({
  imports: [ConfigModule],
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
