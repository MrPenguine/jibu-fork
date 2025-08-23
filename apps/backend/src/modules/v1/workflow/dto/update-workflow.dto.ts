import { IsOptional, IsString, IsJSON, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkflowDto {
  @ApiProperty({
    description: 'Name of the workflow',
    example: 'Customer Support Workflow',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Description of the workflow',
    example: 'A workflow for handling customer support queries',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Entire workflow definition as JSON',
    required: false,
    example: '{"nodes": [], "edges": [], "startNodeId": "start-1"}',
  })
  @IsJSON()
  @IsOptional()
  workflowJson?: Record<string, any>;

  @ApiProperty({
    description: 'Flow nodes data as JSON',
    example: '{"node1": {"id": "node1", "type": "start"}}',
    required: false,
  })
  @IsJSON()
  @IsOptional()
  nodes?: Record<string, any>;

  @ApiProperty({
    description: 'Flow edges data as JSON',
    example: '[{"source": "node1", "target": "node2"}]',
    required: false,
  })
  @IsJSON()
  @IsOptional()
  edges?: Record<string, any>;

  @ApiProperty({
    description: 'ID of the starting node',
    example: 'node1',
    required: false,
  })
  @IsString()
  @IsOptional()
  startNodeId?: string;

  @ApiProperty({
    description: 'Whether the workflow is published',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @ApiProperty({
    description: 'ID of the associated n8n workflow',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsString()
  @IsOptional()
  n8nWorkflowId?: string;

  @ApiProperty({
    description: 'ID of the agent this workflow belongs to',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  agentId?: string;

  @ApiProperty({
    description: 'ID of the workspace this workflow belongs to',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  workspaceId?: string;
}
