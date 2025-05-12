import { Injectable, Logger } from '@nestjs/common';
import { IAgentService, AgentRequest, AgentResponse } from './interfaces/agent.interface';
import { AgentServiceFactory } from './agent.factory';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private agentService: IAgentService;

  constructor(private agentServiceFactory: AgentServiceFactory) {
    this.agentService = this.agentServiceFactory.getAgentService();
  }

  async checkConnection(): Promise<boolean> {
    return this.agentService.checkConnection();
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      return await this.agentService.processRequest(request);
    } catch (error) {
      this.logger.error(`Error processing agent request: ${error.message}`);
      throw error;
    }
  }

  async *processStreamingRequest(request: AgentRequest): AsyncIterable<AgentResponse> {
    try {
      for await (const chunk of this.agentService.processStreamingRequest(request)) {
        yield chunk;
      }
    } catch (error) {
      this.logger.error(`Error processing streaming agent request: ${error.message}`);
      throw error;
    }
  }
}
