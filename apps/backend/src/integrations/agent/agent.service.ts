import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IAgentService, AgentRequest, AgentResponse } from './interfaces/agent.interface';
import { LangchainAgentService } from './providers/langchain/langchain-agent.service';
// Import needed services
import { AgentExecutionService } from '../../modules/v1/agent/execution/agent-execution.service';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private langchainAgentService: LangchainAgentService,
    private modulesRef: ModuleRef,
    @Inject(forwardRef(() => AgentExecutionService))
    private agentExecutionService: AgentExecutionService,
    private prisma: PrismaService
  ) {}
  
  /**
   * Helper function to extract workspace ID from a session ID if possible
   * Session IDs often follow a pattern that includes the workspace ID
   */
  private extractWorkspaceIdFromSessionId(sessionId: string): string | null {
    if (!sessionId) {
      return null;
    }
    
    // Common session ID format: agent:agentId:workspaceId-userId-timestamp
    // or chat:agent:agentId:workspaceId-...
    try {
      // Attempt to extract from chat session ID
      if (sessionId.includes('-')) {
        const parts = sessionId.split('-');
        if (parts.length >= 2) {
          const possibleOrgId = parts[0].includes(':') ? parts[0].split(':').pop() : parts[0];
          this.logger.log(`[AGENT_ASSISTANT_DEBUG] Extracted workspace ID from session: ${possibleOrgId}`);
          return possibleOrgId;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error(`[AGENT_ASSISTANT_DEBUG] Error extracting workspace ID from session: ${error.message}`);
      return null;
    }
  }

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

  async *processStreamingRequest(request: AgentRequest & { workspaceId?: string }): AsyncIterable<AgentResponse> {
    try {
      this.logger.log(`[AGENT_ASSISTANT_DEBUG] Processing streaming request with input: ${request.input?.substring(0, 50)}...`);
      this.logger.log(`[AGENT_ASSISTANT_DEBUG] Full request config: ${JSON.stringify(request.config)}`);
      
      // If this is a workflow agent and assistantId is present, treat assistantId as agentId
      if (request.config?.assistantId && request.config?.workflowAgent) {
        this.logger.log(`[AGENT_ASSISTANT_DEBUG] Workflow agent request received. Treating assistantId=${request.config.assistantId} as agentId (back-compat).`);
        // No translation needed here; LangchainAgentService will resolve assistantId as agentId
      } else if (request.config?.assistantId) {
        this.logger.log(`[AGENT_ASSISTANT_DEBUG] Processing request with assistantId (interpreted as agentId): ${request.config.assistantId}`);
      } else {
        this.logger.warn(`[AGENT_ASSISTANT_DEBUG] Request has no assistantId in config`);
      }
      
      // Standard processing path
      this.logger.log(`[AGENT_ASSISTANT_DEBUG] Using standard processing path for request`);
      for await (const chunk of this.langchainAgentService.processStreamingRequest(request)) {
        // Log metadata about the chunk to trace assistantId usage
        if (chunk.metadata) {
          this.logger.log(`[AGENT_ASSISTANT_DEBUG] Chunk metadata from standard path: ${JSON.stringify(chunk.metadata)}`);
        }
        yield chunk;
      }
      this.logger.log(`[AGENT_ASSISTANT_DEBUG] Completed streaming standard request`);
    } catch (error) {
      this.logger.error(`[AGENT_ASSISTANT_DEBUG] Error processing streaming agent request: ${error.message}`, error.stack);
      throw error;
    }
  }
}
