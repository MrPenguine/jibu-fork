import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsObject, IsUUID } from 'class-validator';

export class UpdateAssistantDto {
  @ApiProperty({ description: 'The name of the assistant', required: false })
  @IsString()
  @IsOptional()
  name?: string;
  
  @ApiProperty({ description: 'Optional description of the assistant (stored in firstMessage)', required: false })
  @IsString()
  @IsOptional()
  description?: string;
  
  @ApiProperty({ description: 'System prompt for the assistant (stored in voicemailMessage)', required: false })
  @IsString()
  @IsOptional()
  systemPrompt?: string;
  
  @ApiProperty({ description: 'ID of the knowledge base to link to this assistant', required: false })
  @IsUUID()
  @IsOptional()
  knowledgeBaseId?: string | null;
  
  @ApiProperty({ description: 'Whether HIPAA compliance is enabled for this assistant', required: false })
  @IsBoolean()
  @IsOptional()
  hipaaEnabled?: boolean;
  
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