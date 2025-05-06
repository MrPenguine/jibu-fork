import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateKnowledgeBaseDto {
  @ApiProperty({
    description: 'Updated name of the knowledge base',
    example: 'Updated Company Documentation',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
} 