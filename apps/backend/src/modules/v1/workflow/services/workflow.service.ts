import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from '../dto';
import { Workflow } from '@prisma/client';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createWorkflowDto: CreateWorkflowDto, organizationId: string): Promise<Workflow> {
    // Verify the assistant belongs to the organization
    const assistant = await this.prisma.assistant.findFirst({
      where: {
        id: createWorkflowDto.assistantId,
        organizationId,
      },
    });

    if (!assistant) {
      throw new BadRequestException(`Assistant with ID ${createWorkflowDto.assistantId} not found in this organization`);
    }

    return this.prisma.workflow.create({
      data: {
        name: createWorkflowDto.name,
        description: createWorkflowDto.description,
        nodes: JSON.stringify(createWorkflowDto.nodes),
        edges: JSON.stringify(createWorkflowDto.edges),
        startNodeId: createWorkflowDto.startNodeId,
        assistantId: createWorkflowDto.assistantId,
        organizationId,
      },
    });
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

    // If isPublished is being set to true, update publishedAt
    const data: any = { ...updateWorkflowDto };
    if (updateWorkflowDto.isPublished === true) {
      data.publishedAt = new Date();
    }

    return this.prisma.workflow.update({
      where: {
        id,
      },
      data,
    });
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
