import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentProvider } from './agent.types';
import { IAgentService } from './interfaces/agent.interface';
import { LangflowAgentService } from './providers/langflow/langflow-agent.service';

@Injectable()
export class AgentServiceFactory {
  private readonly logger = new Logger(AgentServiceFactory.name);

  constructor(
    private configService: ConfigService,
    private langflowAgentService: LangflowAgentService,
  ) {}

  getAgentService(): IAgentService {
    const provider = this.configService.get<string>('AGENT_PROVIDER', AgentProvider.LANGFLOW);
    
    this.logger.log(`Using agent provider: ${provider}`);
    
    switch (provider) {
      case AgentProvider.LANGFLOW:
        return this.langflowAgentService;
      default:
        this.logger.warn(`Unknown agent provider: ${provider}, falling back to Langflow`);
        return this.langflowAgentService;
    }
  }
}
