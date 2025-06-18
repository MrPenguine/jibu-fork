import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateKnowledgeBaseDto {
  @ApiProperty({
    description: 'The name of the knowledge base',
    example: 'Company Knowledge',
  })
  @IsNotEmpty()
  @IsString()
  name: string;
  
  @ApiProperty({
    description: 'Optional description of the knowledge base',
    example: 'Contains company policies and procedures',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Organization ID that this knowledge base belongs to. If not provided, it will be determined from request context.',
    example: '5d58b0b2-52cf-44f7-9cef-4932dc9e1591',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  @IsString()
  organizationId?: string;
} 