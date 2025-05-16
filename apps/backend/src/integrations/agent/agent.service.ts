import { Injectable, Logger } from '@nestjs/common';
import { IAgentService, AgentRequest, AgentResponse } from './interfaces/agent.interface';
import { LangchainAgentService } from './providers/langchain/langchain-agent.service';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private langchainAgentService: LangchainAgentService) {}

  async checkConnection(): Promise<boolean> {
    return this.langchainAgentService.checkConnection();
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      return await this.langchainAgentService.processRequest(request);
    } catch (error) {
      this.logger.error(`Error processing agent request: ${error.message}`);
      throw error;
    }
  }

  async *processStreamingRequest(request: AgentRequest): AsyncIterable<AgentResponse> {
    try {
      for await (const chunk of this.langchainAgentService.processStreamingRequest(request)) {
        yield chunk;
      }
    } catch (error) {
      this.logger.error(`Error processing streaming agent request: ${error.message}`);
      throw error;
    }
  }
}
