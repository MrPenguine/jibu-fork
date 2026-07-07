import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const EMBEDDING_PROVIDERS = ['gemini', 'openai', 'ollama'] as const;
export const EMBEDDING_MODELS = [
  'gemini-embedding-001',
  'text-embedding-3-small',
  'text-embedding-3-large',
  'nomic-embed-text-v2-moe',
  'qwen3-embedding',
  'qwen3-embedding:0.6b',
] as const;

export class RetrievalConfigDto {
  @ApiProperty({ description: 'Number of chunks to retrieve (top-K)', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topK?: number;

  @ApiProperty({ description: 'System prompt used at answer time', required: false })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiProperty({ description: 'Answer model temperature', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiProperty({ description: 'Max tokens for the answer', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8192)
  maxTokens?: number;
}

export class DefaultChunkConfigDto {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  strategies?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(32000)
  chunkSize?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4000)
  chunkOverlap?: number;
}

export class KnowledgeBaseSettingsDto {
  @ApiProperty({ description: 'Workspace ID', required: false })
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @ApiProperty({ enum: EMBEDDING_PROVIDERS, required: false })
  @IsOptional()
  @IsIn(EMBEDDING_PROVIDERS as unknown as string[])
  embeddingProvider?: string;

  @ApiProperty({ enum: EMBEDDING_MODELS, required: false })
  @IsOptional()
  @IsIn(EMBEDDING_MODELS as unknown as string[])
  embeddingModel?: string;

  @ApiProperty({ type: RetrievalConfigDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => RetrievalConfigDto)
  retrievalConfig?: RetrievalConfigDto;

  @ApiProperty({ type: DefaultChunkConfigDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => DefaultChunkConfigDto)
  defaultChunkConfig?: DefaultChunkConfigDto;
}
