import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateAssistantDto } from './dto/create-assistant.dto';
import { UpdateAssistantDto, ModelConfigDto } from './dto/update-assistant.dto';
// N8N imports removed

// Interface for model configuration
interface ModelConfig {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  preference?: 'latency' | 'balance' | 'capability';
  template?: string;
  [key: string]: any; // Allow other properties
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  
  constructor(
    private prisma: PrismaService
    // N8N service dependency removed
  ) {}

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
    const { organizationId, name, description, systemPrompt, templateId, knowledgeBaseId, model } = createAssistantDto;

    // Validate that the user has access to this organization
    const hasAccess = await this.validateUserOrgAccess(userId, organizationId);
    if (!hasAccess) {
      throw new HttpException('User does not have access to this organization', HttpStatus.FORBIDDEN);
    }

    // Default values for firstMessage and voicemailMessage
    const defaultFirstMessage = "[placeholder, replace with actual first message]::Thank you for calling Wellness Partners. This is Riley, your scheduling assistant. How may I help you today?";
    const defaultSystemPrompt = "{# Appointment Scheduling Agent Prompt\n\n## Identity & Purpose\n\nYou are Riley, an appointment scheduling voice assistant for Wellness Partners, a multi-specialty health clinic. Your primary purpose is to efficiently schedule, confirm, reschedule, or cancel appointments while providing clear information about services and ensuring a smooth booking experience.";

    // Prepare model configuration
    let modelConfig: ModelConfig | null = null;
    
    // If model configuration is provided, use it
    if (model) {
      modelConfig = {
        provider: model.provider,
        model: model.model,
        temperature: model.temperature,
        maxTokens: model.maxTokens,
        preference: model.preference
      };
      
      // Remove any undefined values
      Object.keys(modelConfig).forEach(key => {
        if (modelConfig && modelConfig[key as keyof ModelConfig] === undefined) {
          delete modelConfig[key as keyof ModelConfig];
        }
      });
    }
    
    // Add templateId as a backward compatibility if needed
    if (templateId && (!modelConfig || !modelConfig.model)) {
      if (!modelConfig) modelConfig = {};
      modelConfig.model = templateId;
    }

    this.logger.log(`Creating assistant with model config: ${JSON.stringify(modelConfig)}`);
    
    try {
      // Create the assistant without N8N workflow
      const assistant = await this.prisma.assistant.create({
        data: {
          name,
          organizationId,
          // Optional fields
          ...(knowledgeBaseId && { knowledgeBaseId }),
          ...(modelConfig && { model: modelConfig }),
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
      
      return assistant;
    } catch (error) {
      this.logger.error(`Failed to create assistant: ${error.message}`);
      throw new HttpException(
        `Failed to create assistant: ${error.message}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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
    console.log(`Updating assistant ${id} with data:`, JSON.stringify(updateAssistantDto, null, 2));
    
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
    const { name, description, systemPrompt, knowledgeBaseId, hipaaEnabled, model, voice } = updateAssistantDto;
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.firstMessage = description;
    if (systemPrompt !== undefined) updateData.voicemailMessage = systemPrompt;
    if (knowledgeBaseId !== undefined) updateData.knowledgeBaseId = knowledgeBaseId;
    if (hipaaEnabled !== undefined) updateData.hipaaEnabled = hipaaEnabled;
    
    // Handle model configuration
    if (model !== undefined) {
      console.log('Received model configuration:', model);
      
      // Create a new model configuration instead of merging with existing
      updateData.model = {
        provider: model.provider,
        model: model.model,
        temperature: model.temperature,
        maxTokens: model.maxTokens,
        preference: model.preference
      };
      
      // Remove any undefined values
      Object.keys(updateData.model).forEach(key => {
        if (updateData.model[key] === undefined) {
          delete updateData.model[key];
        }
      });
      
      console.log('New model configuration:', updateData.model);
    }
    
    // Handle voice configuration
    if (voice !== undefined) {
      console.log('Received voice configuration:', voice);
      
      // Create a new voice configuration
      updateData.voice = {
        provider: voice.provider,
        voiceId: voice.voiceId,
        name: voice.name,
        model: voice.model,
        similarityBoost: voice.similarityBoost,
        stability: voice.stability,
        speakerBoost: voice.speakerBoost,
        autoMode: voice.autoMode
      };
      
      // Remove any undefined values
      Object.keys(updateData.voice).forEach(key => {
        if (updateData.voice[key] === undefined) {
          delete updateData.voice[key];
        }
      });
      
      console.log('New voice configuration:', updateData.voice);
    }

    // Update the assistant
    const result = await this.prisma.assistant.update({
      where: { id },
      data: updateData,
    });
    
    console.log(`Assistant ${id} updated successfully. New data:`, JSON.stringify(result, null, 2));
    
    return result;
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