import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';

export class LinkFileSourceDto {
  @ApiProperty({
    description: 'ID of the file to link as a knowledge base source',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  fileId: string;
  
  @ApiProperty({
    description: 'Organization ID that owns the knowledge base and file',
    example: 'f9c21618-9311-441b-a170-36eb41fbcbfa',
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsUUID()
  organizationId?: string;
} 