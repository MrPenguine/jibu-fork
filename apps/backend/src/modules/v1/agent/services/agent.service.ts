import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { CreateAgentDto, UpdateAgentDto } from '../dto';
import { Agent } from '@prisma/client';

@Injectable()
export class AgentService {
  constructor(private readonly prisma: PrismaService) {}

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
        // Find a default assistant for this organization if none is provided
        // This is a workaround for the database constraint requiring an assistantId
        console.log('No assistantId provided, looking for a default assistant in the organization');
        const defaultAssistant = await this.prisma.assistant.findFirst({
          where: { organizationId },
          orderBy: { createdAt: 'asc' },
        });
        
        if (defaultAssistant) {
          console.log(`Found default assistant: ${defaultAssistant.id}`);
          createAgentDto.assistantId = defaultAssistant.id;
        } else {
          console.error('No assistants found in this organization');
          throw new BadRequestException('This organization has no assistants. Please create an assistant first or provide a valid assistantId.');
        }
      }

      // Create the base data object
      const createData: any = {
        name: createAgentDto.name,
        description: createAgentDto.description || '',
        nodes: JSON.stringify(createAgentDto.nodes || []),
        edges: JSON.stringify(createAgentDto.edges || []),
        startNodeId: createAgentDto.startNodeId,
        organization: {
          connect: { id: organizationId }
        },
        // Always include assistant relation since database requires it
        assistant: {
          connect: { id: createAgentDto.assistantId }
        }
      };

      console.log('Creating agent with data:', JSON.stringify(createData, null, 2));
      
      // Create the agent
      return this.prisma.agent.create({
        data: createData,
        include: {
          assistant: true,
          organization: true
        }
      });
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
    });
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
    });
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

    return agent;
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
    
    // Handle basic fields
    if (updateAgentDto.name !== undefined) {
      updateData.name = updateAgentDto.name;
    }
    
    if (updateAgentDto.description !== undefined) {
      updateData.description = updateAgentDto.description;
    }
    
    if (updateAgentDto.nodes !== undefined) {
      updateData.nodes = JSON.stringify(updateAgentDto.nodes);
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
      });
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
    });
  }

  async publish(id: string, organizationId: string): Promise<Agent> {
    // Verify the agent exists and belongs to the organization
    await this.findOne(id, organizationId);

    return this.prisma.agent.update({
      where: {
        id,
      },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  async unpublish(id: string, organizationId: string): Promise<Agent> {
    // Verify the agent exists and belongs to the organization
    await this.findOne(id, organizationId);

    return this.prisma.agent.update({
      where: {
        id,
      },
      data: {
        isPublished: false,
        publishedAt: null,
      },
    });
  }
}
