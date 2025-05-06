import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateAssistantDto } from './dto/create-assistant.dto';
import { UpdateAssistantDto } from './dto/update-assistant.dto';

@Injectable()
export class AssistantService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if a user has access to an organization
   */
  private async validateUserOrgAccess(userId: string, organizationId: string): Promise<boolean> {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        status: 'active',
      },
    });

    return !!membership;
  }

  /**
   * Create a new assistant
   */
  async create(createAssistantDto: CreateAssistantDto, userId: string) {
    const { organizationId, name, description, systemPrompt, templateId, knowledgeBaseId, config } = createAssistantDto;

    // Validate that the user has access to this organization
    const hasAccess = await this.validateUserOrgAccess(userId, organizationId);
    if (!hasAccess) {
      throw new HttpException('User does not have access to this organization', HttpStatus.FORBIDDEN);
    }

    // Default values for firstMessage and voicemailMessage
    const defaultFirstMessage = "[placeholder, replace with actual first message]::Thank you for calling Wellness Partners. This is Riley, your scheduling assistant. How may I help you today?";
    const defaultSystemPrompt = "{# Appointment Scheduling Agent Prompt\n\n## Identity & Purpose\n\nYou are Riley, an appointment scheduling voice assistant for Wellness Partners, a multi-specialty health clinic. Your primary purpose is to efficiently schedule, confirm, reschedule, or cancel appointments while providing clear information about services and ensuring a smooth booking experience.";

    // Create the assistant with fields that match the schema
    return this.prisma.assistant.create({
      data: {
        name,
        organizationId,
        // Optional fields
        ...(knowledgeBaseId && { knowledgeBaseId }),
        ...(templateId && { model: { template: templateId } }),
        firstMessage: description || defaultFirstMessage,
        voicemailMessage: systemPrompt || defaultSystemPrompt,
        // Set default values
        hipaaEnabled: false,
        backgroundDenoisingEnabled: false,
        endCallPhrases: [],
        serverMessages: [],
        clientMessages: [],
      },
    });
  }

  /**
   * Find all assistants for an organization
   */
  async findAllByOrganization(organizationId: string, userId: string) {
    // Validate that the user has access to this organization
    const hasAccess = await this.validateUserOrgAccess(userId, organizationId);
    if (!hasAccess) {
      throw new HttpException('User does not have access to this organization', HttpStatus.FORBIDDEN);
    }

    // Get all assistants for this organization
    return this.prisma.assistant.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Find a single assistant by ID
   */
  async findOne(id: string, userId: string) {
    // Get the assistant
    const assistant = await this.prisma.assistant.findUnique({
      where: { id },
    });

    if (!assistant) {
      throw new HttpException('Assistant not found', HttpStatus.NOT_FOUND);
    }

    // Validate that the user has access to this organization
    const hasAccess = await this.validateUserOrgAccess(userId, assistant.organizationId);
    if (!hasAccess) {
      throw new HttpException('User does not have access to this assistant', HttpStatus.FORBIDDEN);
    }

    return assistant;
  }

  /**
   * Update an assistant
   */
  async update(id: string, updateAssistantDto: UpdateAssistantDto, userId: string) {
    // Get the assistant
    const assistant = await this.prisma.assistant.findUnique({
      where: { id },
    });

    if (!assistant) {
      throw new HttpException('Assistant not found', HttpStatus.NOT_FOUND);
    }

    // Validate that the user has access to this organization
    const hasAccess = await this.validateUserOrgAccess(userId, assistant.organizationId);
    if (!hasAccess) {
      throw new HttpException('User does not have access to this assistant', HttpStatus.FORBIDDEN);
    }

    // Map update DTO to Assistant schema fields
    const { name, description, systemPrompt, knowledgeBaseId, hipaaEnabled, config } = updateAssistantDto;
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.firstMessage = description;
    if (systemPrompt !== undefined) updateData.voicemailMessage = systemPrompt;
    if (knowledgeBaseId !== undefined) updateData.knowledgeBaseId = knowledgeBaseId;
    if (hipaaEnabled !== undefined) updateData.hipaaEnabled = hipaaEnabled;
    if (config !== undefined) updateData.model = config;

    // Update the assistant
    return this.prisma.assistant.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete an assistant
   */
  async remove(id: string, userId: string) {
    // Get the assistant
    const assistant = await this.prisma.assistant.findUnique({
      where: { id },
    });

    if (!assistant) {
      throw new HttpException('Assistant not found', HttpStatus.NOT_FOUND);
    }

    // Validate that the user has access to this organization
    const hasAccess = await this.validateUserOrgAccess(userId, assistant.organizationId);
    if (!hasAccess) {
      throw new HttpException('User does not have access to this assistant', HttpStatus.FORBIDDEN);
    }

    // Delete the assistant
    return this.prisma.assistant.delete({
      where: { id },
    });
  }
} 