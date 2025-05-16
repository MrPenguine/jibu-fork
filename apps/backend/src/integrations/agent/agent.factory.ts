import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentProvider } from './agent.types';
import { IAgentService } from './interfaces/agent.interface';
import { LangflowAgentService } from './providers/langflow/langflow-agent.service';
import { LangchainAgentService } from './providers/langchain/langchain-agent.service';

@Injectable()
export class AgentServiceFactory {
  private readonly logger = new Logger(AgentServiceFactory.name);

  constructor(
    private configService: ConfigService,
    private langflowAgentService: LangflowAgentService,
    private langchainAgentService: LangchainAgentService,
  ) {}

  getAgentService(): IAgentService {
    const provider = this.configService.get<string>('AGENT_PROVIDER', AgentProvider.LANGCHAIN);
    
    this.logger.log(`Using agent provider: ${provider}`);
    
    switch (provider) {
      case AgentProvider.LANGFLOW:
        return this.langflowAgentService;
      case AgentProvider.LANGCHAIN:
        return this.langchainAgentService;
      default:
        this.logger.warn(`Unknown agent provider: ${provider}, falling back to Langchain`);
        return this.langchainAgentService;
    }
  }
}
