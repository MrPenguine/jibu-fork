import { IsOptional, IsString, IsJSON, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkflowDto {
  @ApiProperty({
    description: 'Name of the workflow',
    example: 'Customer Support Workflow',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Description of the workflow',
    example: 'A workflow for handling customer support queries',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

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
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @ApiProperty({
    description: 'Workspace ID that the workflow belongs to',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  workspaceId?: string;
}
