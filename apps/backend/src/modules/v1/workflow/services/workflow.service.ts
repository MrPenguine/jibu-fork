import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from '../dto';
import { Workflow } from '@prisma/client';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createWorkflowDto: CreateWorkflowDto, organizationId: string): Promise<Workflow> {
    console.log('Creating workflow with organization ID:', organizationId);
    console.log('Workflow data:', createWorkflowDto);
    
    // Validate organizationId
    if (!organizationId) {
      console.error('Organization ID is missing in workflow creation');
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
      if (createWorkflowDto.assistantId) {
        const assistant = await this.prisma.assistant.findFirst({
          where: {
            id: createWorkflowDto.assistantId,
            organizationId,
          },
        });

        if (!assistant) {
          console.error(`Assistant with ID ${createWorkflowDto.assistantId} not found in organization ${organizationId}`);
          throw new BadRequestException(`Assistant with ID ${createWorkflowDto.assistantId} not found in this organization`);
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
          createWorkflowDto.assistantId = defaultAssistant.id;
        } else {
          console.error('No assistants found in this organization');
          throw new BadRequestException('This organization has no assistants. Please create an assistant first or provide a valid assistantId.');
        }
      }

      // Create the base data object
      const createData: any = {
        name: createWorkflowDto.name,
        description: createWorkflowDto.description || '',
        nodes: JSON.stringify(createWorkflowDto.nodes || []),
        edges: JSON.stringify(createWorkflowDto.edges || []),
        startNodeId: createWorkflowDto.startNodeId,
        organization: {
          connect: { id: organizationId }
        },
        // Always include assistant relation since database requires it
        assistant: {
          connect: { id: createWorkflowDto.assistantId }
        }
      };

      console.log('Creating workflow with data:', JSON.stringify(createData, null, 2));
      
      // Create the workflow
      return this.prisma.workflow.create({
        data: createData,
        include: {
          assistant: true,
          organization: true
        }
      });
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw new BadRequestException(`Failed to create workflow: ${error.message}`);
    }
  }

  async findAll(organizationId: string): Promise<Workflow[]> {
    return this.prisma.workflow.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async findAllByAssistant(assistantId: string, organizationId: string): Promise<Workflow[]> {
    return this.prisma.workflow.findMany({
      where: {
        assistantId,
        organizationId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async findOne(id: string, organizationId: string): Promise<Workflow> {
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    return workflow;
  }

  async update(id: string, updateWorkflowDto: UpdateWorkflowDto, organizationId: string): Promise<Workflow> {
    // Validate organizationId
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }
    
    // Verify the workflow exists and belongs to the organization
    await this.findOne(id, organizationId);

    // If assistantId is provided, verify it belongs to the organization
    if (updateWorkflowDto.assistantId) {
      const assistant = await this.prisma.assistant.findFirst({
        where: {
          id: updateWorkflowDto.assistantId,
          organizationId,
        },
      });

      if (!assistant) {
        throw new BadRequestException(`Assistant with ID ${updateWorkflowDto.assistantId} not found in this organization`);
      }
    }

    // Prepare the update data
    const updateData: any = {};
    
    // Handle basic fields
    if (updateWorkflowDto.name !== undefined) {
      updateData.name = updateWorkflowDto.name;
    }
    
    if (updateWorkflowDto.description !== undefined) {
      updateData.description = updateWorkflowDto.description;
    }
    
    if (updateWorkflowDto.nodes !== undefined) {
      updateData.nodes = JSON.stringify(updateWorkflowDto.nodes);
    }
    
    if (updateWorkflowDto.edges !== undefined) {
      updateData.edges = JSON.stringify(updateWorkflowDto.edges);
    }
    
    if (updateWorkflowDto.startNodeId !== undefined) {
      updateData.startNodeId = updateWorkflowDto.startNodeId;
    }
    
    if (updateWorkflowDto.isPublished !== undefined) {
      updateData.isPublished = updateWorkflowDto.isPublished;
      // If isPublished is being set to true, update publishedAt
      if (updateWorkflowDto.isPublished === true) {
        updateData.publishedAt = new Date();
      }
    }
    
    // Handle the assistant relation properly
    if (updateWorkflowDto.assistantId !== undefined) {
      if (updateWorkflowDto.assistantId === null) {
        // If assistantId is explicitly set to null, disconnect the assistant
        updateData.assistant = { disconnect: true };
      } else {
        // If assistantId is provided, connect to that assistant
        updateData.assistant = { connect: { id: updateWorkflowDto.assistantId } };
      }
    }

    try {
      return this.prisma.workflow.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      console.error('Error updating workflow:', error);
      throw new BadRequestException(`Failed to update workflow: ${error.message}`);
    }
  }

  async remove(id: string, organizationId: string): Promise<Workflow> {
    // Verify the workflow exists and belongs to the organization
    await this.findOne(id, organizationId);

    return this.prisma.workflow.delete({
      where: {
        id,
      },
    });
  }

  async publish(id: string, organizationId: string): Promise<Workflow> {
    // Verify the workflow exists and belongs to the organization
    await this.findOne(id, organizationId);

    return this.prisma.workflow.update({
      where: {
        id,
      },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  async unpublish(id: string, organizationId: string): Promise<Workflow> {
    // Verify the workflow exists and belongs to the organization
    await this.findOne(id, organizationId);

    return this.prisma.workflow.update({
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
