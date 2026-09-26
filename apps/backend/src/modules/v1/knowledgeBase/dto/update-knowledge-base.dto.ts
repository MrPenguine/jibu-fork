import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';

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

  @ApiProperty({
    description: 'AGENT: private, only usable by agents it is explicitly linked to. WORKSPACE: attachable by any agent in the workspace.',
    enum: ['AGENT', 'WORKSPACE'],
    required: false,
  })
  @IsOptional()
  @IsIn(['AGENT', 'WORKSPACE'])
  visibility?: 'AGENT' | 'WORKSPACE';
}