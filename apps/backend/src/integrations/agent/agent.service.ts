import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IAgentService, AgentRequest, AgentResponse } from './interfaces/agent.interface';
import { LangchainAgentService } from './providers/langchain/langchain-agent.service';
import { AgentRuntimeService } from './agent-runtime.service';
// Import needed services
import { AgentExecutionService } from '../../modules/v1/agent/execution/agent-execution.service';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private langchainAgentService: LangchainAgentService,
    private readonly agentRuntime: AgentRuntimeService,
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

  async processRequest(request: AgentRequest & { workspaceId?: string }): Promise<AgentResponse> {
    try {
      // Single-brain path: delegate to the channel-agnostic runtime.
      const agentId = request.config?.assistantId;
      if (!agentId) {
        throw new Error('Agent ID is required');
      }
      const result = await this.agentRuntime.runTurn({
        agentId,
        channel: 'chat',
        sessionId: request.sessionId,
        input: request.input,
        workspaceId: request.workspaceId,
        knowledgeBaseId: request.config?.knowledgeBaseId,
      });
      return { output: result.output, sessionId: request.sessionId, metadata: result.meta };
    } catch (error) {
      this.logger.error(`Error processing agent request: ${error.message}`);
      throw error;
    }
  }

  async *processStreamingRequest(request: AgentRequest & { workspaceId?: string }): AsyncIterable<AgentResponse> {
    try {
      const agentId = request.config?.assistantId;
      if (!agentId) {
        throw new Error('Agent ID is required');
      }
      // Single-brain path: delegate streaming to the channel-agnostic runtime.
      for await (const chunk of this.agentRuntime.streamTurn({
        agentId,
        channel: 'chat',
        sessionId: request.sessionId,
        input: request.input,
        workspaceId: request.workspaceId,
        knowledgeBaseId: request.config?.knowledgeBaseId,
      })) {
        yield { output: chunk.output, sessionId: request.sessionId, metadata: chunk.meta };
      }
    } catch (error) {
      this.logger.error(`[AGENT_ASSISTANT_DEBUG] Error processing streaming agent request: ${error.message}`, error.stack);
      throw error;
    }
  }
}
