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
      
      // Check if this is a workflow agent but we received an assistantId that might actually be an agentId
      if (request.config?.assistantId && request.config?.workflowAgent) {
        this.logger.log(`[AGENT_ASSISTANT_DEBUG] Received request for a workflow agent with assistantId: ${request.config.assistantId}`);
        
        // Log the session ID for correlation
        if (request.sessionId) {
          this.logger.log(`[AGENT_ASSISTANT_DEBUG] Request session ID: ${request.sessionId}`);
        }
        
        // Extract the correct assistantId using AgentExecutionService instead of trying to access WorkflowService directly
        try {
          const agentId = request.config.assistantId;
          this.logger.log(`[AGENT_ASSISTANT_DEBUG] Extracting correct assistantId for agent: ${agentId}`);
          
          // Use the extractWorkspaceIdFromSessionId if workspaceId is not provided directly
          const workspaceId = request.workspaceId || this.extractWorkspaceIdFromSessionId(request.sessionId);
          if (!workspaceId) {
            throw new Error('Workspace ID not available');
          }
          
          this.logger.log(`[AGENT_ASSISTANT_DEBUG] Looking for agent workflow data for agent ${agentId} in workspace ${workspaceId}`);
          
          // Use the directly injected prisma service to find the agent data
          
          // Get the agent with workflow data
          const agent = await this.prisma.agent.findFirst({
            where: {
              id: agentId,
              workspaceId
            }
          });
          
          if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
          }
          
          // Get the workflow for the agent - this is crucial for logging the workflow ID as requested
          // Use ModuleRef to get the WorkflowService - but wrap in try/catch to handle potential injection failures
          let workflowId = null;
          try {
            const workflowService = this.modulesRef.get('WorkflowService', { strict: false });
            if (workflowService) {
              const workflows = await workflowService.getAgentWorkflows(agentId, workspaceId);
              if (workflows && workflows.length > 0) {
                workflowId = workflows[0].id;
                this.logger.log(`[AGENT_ASSISTANT_DEBUG] Found workflow ${workflowId} for agent ${agentId}`);
              }
            }
          } catch (workflowError) {
            // Just log the error but continue - we don't want to fail the request if we can't get the workflow ID
            this.logger.warn(`[AGENT_ASSISTANT_DEBUG] Could not get workflow ID: ${workflowError.message}`);
          }
          
          // Get the published workflow data containing nodes through the AgentExecutionService
          this.logger.log(`[AGENT_ASSISTANT_DEBUG] Using agent execution service to process workflow agent request`);
          
          // Find the correct assistantId from an ASSISTANT node in the workflow
          // First check if the agent has a direct assistantId
          let realAssistantId = agent.assistantId;
          
          if (!realAssistantId) {
            // Try to get it from the agent execution service in a separate transaction
            try {
              // Using prisma directly to get workflow nodes - this is a workaround when AgentExecutionService injection fails
              const publishedWorkflow = await this.prisma.workflow.findFirst({
                where: {
                  agentId,
                  isPublished: true,
                  workspaceId
                }
              });
              
              if (publishedWorkflow) {
                workflowId = publishedWorkflow.id;
                this.logger.log(`[AGENT_ASSISTANT_DEBUG] Found published workflow ${workflowId} for agent ${agentId}`);

                // Extract nodes from consolidated workflowJson
                let nodes: any = {};
                try {
                  const wfJson = (publishedWorkflow as any).workflowJson;
                  const parsed = typeof wfJson === 'string' ? JSON.parse(wfJson) : wfJson;
                  nodes = parsed?.nodes || {};
                } catch (e) {
                  this.logger.warn(`[AGENT_ASSISTANT_DEBUG] Could not parse workflowJson for ${workflowId}: ${e.message}`);
                  nodes = {};
                }

                // Search for ASSISTANT node
                for (const nodeId in nodes) {
                  const node = nodes[nodeId];
                  if (node?.type === 'ASSISTANT' && (node.data?.assistantId || node.data?.apiAssistantId)) {
                    realAssistantId = node.data.assistantId || node.data.apiAssistantId;
                    this.logger.log(`[AGENT_ASSISTANT_DEBUG] Found assistantId ${realAssistantId} in workflow ${workflowId}, node ${nodeId}`);
                    break;
                  }
                }
              }
            } catch (executionError) {
              this.logger.error(`[AGENT_ASSISTANT_DEBUG] Error extracting from workflow nodes: ${executionError.message}`);
            }
          }
          
          if (!realAssistantId) {
            throw new Error(`Could not find assistantId for agent ${agentId} in workflow`);
          }
          
          // Replace the incorrect agentId with the correct assistantId
          const modifiedRequest = { ...request };
          if (modifiedRequest.config) {
            this.logger.log(`[AGENT_ASSISTANT_DEBUG] Original assistantId (actually agentId) in request: ${modifiedRequest.config.assistantId}`);
            modifiedRequest.config.assistantId = realAssistantId;
            this.logger.log(`[AGENT_ASSISTANT_DEBUG] Replaced with correct assistantId from workflow: ${realAssistantId}`);
          }
          
          // Continue with the modified request that now has the correct assistantId
          this.logger.log(`[AGENT_ASSISTANT_DEBUG] Forwarding modified request to langchain service with correct assistantId`);
          for await (const chunk of this.langchainAgentService.processStreamingRequest(modifiedRequest)) {
            // Log metadata about the chunk to trace assistantId usage
            if (chunk.metadata) {
              this.logger.log(`[AGENT_ASSISTANT_DEBUG] Chunk metadata: ${JSON.stringify(chunk.metadata)}`);
            }
            yield chunk;
          }
          this.logger.log(`[AGENT_ASSISTANT_DEBUG] Completed streaming workflow agent request`);
          return;
        } catch (extractError) {
          this.logger.error(`[AGENT_ASSISTANT_DEBUG] Error extracting assistantId from workflow: ${extractError.message}`, extractError.stack);
          // Fall through to standard processing if extraction fails
        }
      } else if (request.config?.assistantId) {
        this.logger.log(`[AGENT_ASSISTANT_DEBUG] Processing standard assistant request with assistantId: ${request.config.assistantId}`);
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
