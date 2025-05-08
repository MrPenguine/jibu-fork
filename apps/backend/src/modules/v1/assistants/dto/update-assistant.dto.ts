import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsObject, IsUUID, IsNumber, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ModelConfigDto {
  @ApiProperty({ description: 'The provider of the model (e.g., openai, google, anthropic)', required: false })
  @IsString()
  @IsOptional()
  provider?: string;
  
  @ApiProperty({ description: 'The model ID', required: false })
  @IsString()
  @IsOptional()
  model?: string;
  
  @ApiProperty({ description: 'Temperature setting for model generation (0-1)', required: false })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  temperature?: number;
  
  @ApiProperty({ description: 'Maximum tokens to generate', required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTokens?: number;
  
  @ApiProperty({ 
    description: 'Model preference for filtering and sorting models', 
    required: false,
    enum: ['latency', 'balance', 'capability']
  })
  @IsString()
  @IsOptional()
  preference?: 'latency' | 'balance' | 'capability';
}

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
  
  @ApiProperty({ description: 'Assistant model configuration', required: false, type: ModelConfigDto })
  @ValidateNested()
  @Type(() => ModelConfigDto)
  @IsOptional()
  model?: ModelConfigDto;
} 