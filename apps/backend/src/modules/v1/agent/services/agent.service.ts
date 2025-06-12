import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Agent as PrismaAgent, WorkflowType } from '@prisma/client';

// Extended Agent interface with workflow properties - used only to type our functions
type Agent = {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  assistantId?: string;
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
// Secondary workflow methods have been moved to WorkflowService

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService
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
          console.log(`Found assistantId ${assistantId} in workflow nodes`);
          return assistantId;
        }
      }
      
      return undefined;
    } catch (error) {
      console.warn(`Error extracting assistantId from nodes: ${error.message}`);
      return undefined;
    }
  }

  async create(createAgentDto: CreateAgentDto, organizationId: string): Promise<Agent> {
    console.log('Creating agent with organization ID:', organizationId);
    console.log('Agent data:', createAgentDto);
    
    // Validate organizationId
    if (!organizationId) {
      console.error('Organization ID is missing in agent creation');
      throw new BadRequestException('Organization ID is required');
    }

    try {
      // Verify the organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        console.error(`Organization with ID ${organizationId} not found`);
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
          console.error(`Assistant with ID ${createAgentDto.assistantId} not found in organization ${organizationId}`);
          throw new BadRequestException(`Assistant with ID ${createAgentDto.assistantId} not found in this organization`);
        }
      } else {
        // If no assistantId provided, that's okay - we'll create the agent without an assistant
        console.log('No assistantId provided, creating agent without an assistant');
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

      console.log('Creating agent with data:', JSON.stringify(createData, null, 2));
      
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
        console.log('Creating master workflow for agent:', agentData.id);
        
        // Extract nodes and edges from the DTO if provided
        const nodes = createAgentDto.nodes || {};
        const edges = createAgentDto.edges || {};
        
        // Check if we need to extract assistantId from nodes
        if (!createAgentDto.assistantId) {
          const extractedAssistantId = this.extractAssistantIdFromNodes(nodes);
          if (extractedAssistantId) {
            console.log(`Extracted assistantId ${extractedAssistantId} from workflow nodes`);
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
        
        await this.workflowService.createMasterWorkflow(agentData.id, workflowData);
        console.log('Master workflow created successfully');
      } catch (workflowError) {
        console.error('Error creating master workflow:', workflowError);
        // We don't want to fail the agent creation if workflow creation fails
        // Just log the error and continue
      }
      
      return newAgent;
    } catch (error) {
      console.error('Error creating agent:', error);
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
