import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsBoolean, IsObject } from 'class-validator';

export class CreateAssistantDto {
  @ApiProperty({ description: 'The name of the assistant', example: 'Customer Support Assistant' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'The ID of the organization this assistant belongs to' })
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;
  
  @ApiProperty({ description: 'Optional description of the assistant (stored in firstMessage)', required: false })
  @IsString()
  @IsOptional()
  description?: string;
  
  @ApiProperty({ description: 'System prompt for the assistant (stored in voicemailMessage)', required: false })
  @IsString()
  @IsOptional()
  systemPrompt?: string;
  
  @ApiProperty({ description: 'ID of the template used to create this assistant', required: false })
  @IsString()
  @IsOptional()
  templateId?: string;
  
  @ApiProperty({ description: 'ID of the knowledge base to link to this assistant', required: false })
  @IsUUID()
  @IsOptional()
  knowledgeBaseId?: string;
  
  @ApiProperty({ description: 'Assistant configuration including model and settings', required: false })
  @IsObject()
  @IsOptional()
  config?: {
    provider?: string;
    model?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  };
} 