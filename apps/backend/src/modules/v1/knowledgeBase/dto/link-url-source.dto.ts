import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const REFRESH_RATES = ['never', 'daily', 'weekly', 'monthly'] as const;
export type RefreshRate = (typeof REFRESH_RATES)[number];

export class LinkUrlSourceDto {
  @ApiProperty({
    description: 'One or more URLs to fetch, extract and index',
    example: ['https://example.com/docs', 'https://example.com/pricing'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  urls: string[];

  @ApiProperty({
    description: 'How often to re-crawl the URL(s)',
    enum: REFRESH_RATES,
    example: 'never',
    required: false,
  })
  @IsOptional()
  @IsIn(REFRESH_RATES as unknown as string[])
  refreshRate?: RefreshRate;

  @ApiProperty({
    description: 'Workspace ID that owns the knowledge base',
    required: false,
  })
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @ApiProperty({
    description: 'Optional folder ID to associate the source with',
    required: false,
  })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiProperty({
    description: 'LLM chunking strategies to apply',
    example: ['clean_html', 'faq'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chunkingStrategy?: string[];

  @ApiProperty({ description: 'Target chunk size in characters', required: false })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(32000)
  chunkSize?: number;

  @ApiProperty({ description: 'Chunk overlap in characters', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4000)
  chunkOverlap?: number;
}
