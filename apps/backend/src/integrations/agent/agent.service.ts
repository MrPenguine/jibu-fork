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
      // Check if this is a workflow agent but we received an assistantId that might actually be an agentId
      if (request.config?.assistantId && request.config?.workflowAgent) {
        this.logger.log(`Received request for a workflow agent with assistantId: ${request.config.assistantId}`);
        
        // Need to extract the correct assistantId from workflow nodes
        try {
          // We'll inject a modified request with the correct assistantId
          const modifiedRequest = { ...request };
          
          // Remove the incorrect assistantId from config - let workflow execution handle it
          if (modifiedRequest.config) {
            delete modifiedRequest.config.assistantId;
          }
          
          this.logger.log(`Modified request for workflow agent, removing assistantId from request config`);
          
          // Continue with the modified request
          for await (const chunk of this.langchainAgentService.processStreamingRequest(modifiedRequest)) {
            yield chunk;
          }
          return;
        } catch (extractError) {
          this.logger.error(`Error extracting assistantId from workflow: ${extractError.message}`);
          // Fall through to standard processing if extraction fails
        }
      }
      
      // Standard processing path
      for await (const chunk of this.langchainAgentService.processStreamingRequest(request)) {
        yield chunk;
      }
    } catch (error) {
      this.logger.error(`Error processing streaming agent request: ${error.message}`);
      throw error;
    }
  }
}
