import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Agent as PrismaAgent, WorkflowType } from '@prisma/client';

// Define N8nWorkflowType enum locally until Prisma client is regenerated properly
enum N8nWorkflowType {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY'
}

// Extended Agent interface with workflow properties - used only to type our functions
type Agent = {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  assistantId?: string;
  n8nWorkflowId?: string;
  createdAt: Date;
  updatedAt: Date;
  nodes?: any;
  edges?: any;
  startNodeId?: string;
  isPublished?: boolean;
  workflows?: any[];
};
import { CreateAgentDto } from '../dto/create-agent.dto';
import { PrismaService } from '../../../../core/database/prisma.service';
import { UpdateAgentDto } from '../dto/update-agent.dto';
import { WorkflowService } from '../../workflow/services/workflow.service';
import { CreateWorkflowDto } from '../../workflow/dto/create-workflow.dto';
import { N8nIntegrationService } from '../../../../integrations/n8n/n8n-integration.service';
import { WebhookWorkflowTemplate } from '../../../../integrations/n8n/n8n-types';
// Secondary workflow methods have been moved to WorkflowService

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
    private readonly n8nIntegrationService: N8nIntegrationService
  ) {}

  /**
   * Helper method to extract assistantId from workflow nodes
   * @param nodes The workflow nodes object
   * @returns The assistantId if found, otherwise undefined
   */
  private extractAssistantIdFromNodes(nodes: any): string | undefined {
    try {
      if (!nodes) return undefined;

      // Parse the nodes if they're a string
      const parsedNodes = typeof nodes === 'string' ? JSON.parse(nodes) : nodes;

      // Find assistant nodes that have an assistantId
      const assistantNodes = Object.values(parsedNodes).filter(
        (node: any) => node.type === 'ASSISTANT' && node.data?.assistantId
      );

      // Return the first assistantId found
      if (assistantNodes.length > 0) {
        const assistantId = (assistantNodes[0] as any).data?.assistantId;
        if (assistantId) {
          this.logger.log(`Found assistantId ${assistantId} in workflow nodes`);
          return assistantId;
        }
      }

      return undefined;
    } catch (error) {
      this.logger.warn(`Error extracting assistantId from nodes: ${error.message}`);
      return undefined;
    }
  }

  async create(createAgentDto: CreateAgentDto, organizationId: string): Promise<Agent> {
    this.logger.log(`Creating agent with organization ID: ${organizationId}`);
    this.logger.debug(`Agent data: ${JSON.stringify(createAgentDto)}`);

    
    // Validate organizationId
    if (!organizationId) {
      this.logger.error('Organization ID is missing in agent creation');
      throw new BadRequestException('Organization ID is required');
    }

    try {
      // Verify the organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        this.logger.error(`Organization with ID ${organizationId} not found`);
        throw new BadRequestException(`Organization with ID ${organizationId} not found`);
      }

      // Check if assistantId is provided and verify it belongs to the organization
      if (createAgentDto.assistantId) {
        const assistant = await this.prisma.assistant.findFirst({
          where: {
            id: createAgentDto.assistantId,
            organizationId,
          },
        });

        if (!assistant) {
          this.logger.error(`Assistant with ID ${createAgentDto.assistantId} not found in organization ${organizationId}`);
          throw new BadRequestException(`Assistant with ID ${createAgentDto.assistantId} not found in this organization`);
        }
      } else {
        // If no assistantId provided, that's okay - we'll create the agent without an assistant
        this.logger.log('No assistantId provided, creating agent without an assistant');
        // Agent can be linked to assistant later
      }

      // Create the base data object
      const createData: any = {
        name: createAgentDto.name,
        description: createAgentDto.description || '',
        organization: {
          connect: { id: organizationId }
        }
      };
      
      // Only include assistant relation if assistantId is provided
      if (createAgentDto.assistantId) {
        createData.assistant = {
          connect: { id: createAgentDto.assistantId }
        };
      }

      this.logger.debug(`Creating agent with data: ${JSON.stringify(createData, null, 2)}`);
      
      // Create the agent
      const newAgent = await this.prisma.agent.create({
        data: createData,
        include: {
          assistant: true,
          organization: true
        }
      }) as unknown as Agent;
      
      // Now create a master workflow for the agent
      try {
        // Use type assertion to make TypeScript recognize the properties
        const agentData = newAgent as unknown as { id: string; name: string };
        this.logger.log(`Creating master workflow for agent: ${agentData.id}`);
        
        // Extract nodes and edges from the DTO if provided
        const nodes = createAgentDto.nodes || {};
        const edges = createAgentDto.edges || {};
        
        // Check if we need to extract assistantId from nodes
        if (!createAgentDto.assistantId) {
          const extractedAssistantId = this.extractAssistantIdFromNodes(nodes);
          if (extractedAssistantId) {
            this.logger.log(`Extracted assistantId ${extractedAssistantId} from workflow nodes`);
            // Update the agent with the extracted assistantId
            await this.prisma.agent.update({
              where: { id: newAgent.id },
              data: {
                assistant: { connect: { id: extractedAssistantId } }
              }
            });
            // Update our local instance
            newAgent.assistantId = extractedAssistantId;
          }
        }
        
        const workflowData: CreateWorkflowDto = {
          name: `${agentData.name} Workflow`,
          description: `Master workflow for ${agentData.name}`,
          nodes: nodes,
          edges: edges,
          startNodeId: createAgentDto.startNodeId || '',
          isPublished: false, // Default to false for new agents
          organizationId: organizationId
        };
        
        // Create the workflow entity for the agent
        const workflow = await this.workflowService.createMasterWorkflow(agentData.id, workflowData);
        this.logger.log(`Master workflow created successfully: ${workflow.id}`);
        
        // Create an N8N workflow for the agent
        try {
          // Create a webhook workflow template
          const workflowTemplate: WebhookWorkflowTemplate = {
            name: `primary workflow for agent ${agentData.name} - ${organizationId}`,
            webhookPath: `agent-${agentData.id}`,
            webhookMethod: 'POST', // Default to POST method
            memoryEnabled: true, // Enable memory by default
          };
          
          this.logger.log(`Creating N8N workflow for agent: ${agentData.id}`);
          
          // Create the N8N workflow
          const { workflow: n8nWorkflow, webhookUrl } = await this.n8nIntegrationService.createWebhookWorkflow(workflowTemplate);
          
          this.logger.log(`N8N workflow created successfully: ${n8nWorkflow.id}`);
          this.logger.log(`N8N webhook URL: ${webhookUrl}`);
          
          // Store the N8N workflow in the database with PRIMARY type (default)
          const createdN8nWorkflow = await this.prisma.n8nWorkflow.create({
            data: {
              n8nWorkflowId: n8nWorkflow.id,
              webhookUrl,
              // workflowType defaults to PRIMARY in the schema
              organizationId: organizationId, // Use direct assignment for organizationId
              agents: {
                connect: { id: agentData.id }
              },
              // Save the workflowJson directly (it's already a JSON object)
              workflowJson: n8nWorkflow
              // The workflow will be linked in the next step
            }
          });
          
          this.logger.log(`N8N workflow stored in database: ${createdN8nWorkflow.id}`);
          
          // Update the workflow with the N8N workflow ID
          const updatedWorkflow = await this.prisma.workflow.update({
            where: { id: workflow.id },
            data: {
              n8nWorkflowId: createdN8nWorkflow.id
            }
          });
          
          this.logger.log(`Workflow updated with N8N workflow ID: ${createdN8nWorkflow.id}`);
          
          // No need to update the agent with a reference to the N8N workflow 
          // since we already established the connection through the N8nWorkflow creation
          // The bidirectional relationship is handled by Prisma
          this.logger.log(`Agent already linked to N8N workflow through the N8nWorkflow creation`);
          
          this.logger.log(`Agent updated with N8N workflow reference: ${createdN8nWorkflow.id}`);
          
          // Update our local agent instance with the N8N workflow ID
          newAgent.n8nWorkflowId = createdN8nWorkflow.id;
          
        } catch (n8nWorkflowError) {
          this.logger.error(`Error creating N8N workflow: ${n8nWorkflowError.message}`);
          // We don't want to fail the agent creation if N8N workflow creation fails
          // Just log the error and continue
        }
        
      } catch (workflowError) {
        this.logger.error(`Error creating master workflow: ${workflowError.message}`);
        // We don't want to fail the agent creation if workflow creation fails
        // Just log the error and continue
      }
      
      return newAgent;
    } catch (error) {
      this.logger.error(`Error creating agent: ${error.message}`);
      throw new BadRequestException(`Failed to create agent: ${error.message}`);
    }
  }

  async findAll(organizationId: string): Promise<Agent[]> {
    return this.prisma.agent.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    }) as unknown as Agent[];
  }

  async findAllByAssistant(assistantId: string, organizationId: string): Promise<Agent[]> {
    return this.prisma.agent.findMany({
      where: {
        assistantId,
        organizationId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    }) as unknown as Agent[];
  }

  async findOne(id: string, organizationId: string): Promise<Agent> {
    const agent = await this.prisma.agent.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    return agent as Agent;
  }

  async update(id: string, updateAgentDto: UpdateAgentDto, organizationId: string): Promise<Agent> {
    // Validate organizationId
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    
    // Verify the agent exists and belongs to the organization
    await this.findOne(id, organizationId);

    // If assistantId is provided, verify it belongs to the organization
    if (updateAgentDto.assistantId) {
      const assistant = await this.prisma.assistant.findFirst({
        where: {
          id: updateAgentDto.assistantId,
          organizationId,
        },
      });

      if (!assistant) {
        throw new BadRequestException(`Assistant with ID ${updateAgentDto.assistantId} not found in this organization`);
      }
    }

    // Prepare the update data
    const updateData: any = {};
    
    // Try to extract assistantId from workflow nodes if provided
    let extractedAssistantId: string | undefined;
    if (updateAgentDto.nodes !== undefined) {
      extractedAssistantId = this.extractAssistantIdFromNodes(updateAgentDto.nodes);
      if (extractedAssistantId && updateAgentDto.assistantId === undefined) {
        console.log(`Found assistantId ${extractedAssistantId} in workflow nodes during agent update`);
        // Only use extracted ID if no explicit assistantId was provided
        updateAgentDto.assistantId = extractedAssistantId;
      }
      // Store nodes as usual
      updateData.nodes = JSON.stringify(updateAgentDto.nodes);
    }
    
    // Handle basic fields
    if (updateAgentDto.name !== undefined) {
      updateData.name = updateAgentDto.name;
    }
    
    if (updateAgentDto.description !== undefined) {
      updateData.description = updateAgentDto.description;
    }
    
    if (updateAgentDto.edges !== undefined) {
      updateData.edges = JSON.stringify(updateAgentDto.edges);
    }
    
    if (updateAgentDto.startNodeId !== undefined) {
      updateData.startNodeId = updateAgentDto.startNodeId;
    }
    
    if (updateAgentDto.isPublished !== undefined) {
      updateData.isPublished = updateAgentDto.isPublished;
      // If isPublished is being set to true, update publishedAt
      if (updateAgentDto.isPublished === true) {
        updateData.publishedAt = new Date();
      }
    }
    
    // Handle the assistant relation properly
    if (updateAgentDto.assistantId !== undefined) {
      if (updateAgentDto.assistantId === null) {
        // If assistantId is explicitly set to null, disconnect the assistant
        updateData.assistant = { disconnect: true };
      } else {
        // If assistantId is provided, connect to that assistant
        updateData.assistant = { connect: { id: updateAgentDto.assistantId } };
      }
    }

    try {
      return this.prisma.agent.update({
        where: { id },
        data: updateData,
      }) as unknown as Agent;
    } catch (error) {
      console.error('Error updating agent:', error);
      throw new BadRequestException(`Failed to update agent: ${error.message}`);
    }
  }

  async remove(id: string, organizationId: string): Promise<Agent> {
    // Verify the agent exists and belongs to the organization
    await this.findOne(id, organizationId);

    return this.prisma.agent.delete({
      where: {
        id,
      },
    }) as unknown as Agent;
  }

  async publish(id: string, organizationId: string): Promise<Agent> {
    // Verify the agent exists and belongs to the organization
    const agent = await this.findOne(id, organizationId);

    // Since publication status was moved to the Workflow model, we need to:
    // 1. Update agent's timestamp
    // 2. Update all workflows associated with this agent to be published
    
    // First update the agent
    const updatedAgent = await this.prisma.agent.update({
      where: { id },
      data: { updatedAt: new Date() }
    });
    
    // Then update all workflows associated with this agent
    await this.prisma.workflow.updateMany({
      where: { agentId: id },
      data: {
        isPublished: true,
        publishedAt: new Date()
      }
    });
    
    return updatedAgent as unknown as Agent;
  }

  async unpublish(id: string, organizationId: string): Promise<Agent> {
    try {
      // Verify the agent exists and belongs to the organization
      const agent = await this.findOne(id, organizationId);
      
      if (!agent) {
        throw new NotFoundException(`Agent with ID "${id}" not found`);
      }
      
      // Publication status has been moved to the Workflow model
      // This method is kept for backward compatibility
      return this.prisma.agent.update({
        where: { id },
        data: { updatedAt: new Date() },
      }) as unknown as Agent;
    } catch (error) {
      console.error('Error unpublishing agent:', error);
      throw error;
    }
  }

  /**
   * Get all workflows for a specific agent
   * This includes the master workflow and any associated secondary workflows
   */
  async getAgentWorkflows(agentId: string, organizationId: string): Promise<any[]> {
    try {
      // Workflow-related methods have been moved to WorkflowService
      throw new Error('Method has been moved to WorkflowService');
    } catch (error) {
      console.error('Error getting agent workflows:', error);
      throw error;
    }
  }

  /**
   * Create a secondary workflow that is linked to a master workflow
   */
  async createSecondaryWorkflow(createSecondaryWorkflowParams: any, organizationId: string): Promise<Agent> {
    try {
      // Workflow-related methods have been moved to WorkflowService
      throw new Error('Method has been moved to WorkflowService');
    } catch (error) {
      console.error('Error creating secondary workflow:', error);
      throw error;
    }
  }
}
