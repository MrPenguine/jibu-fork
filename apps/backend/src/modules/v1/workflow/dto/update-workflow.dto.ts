import { IsOptional, IsString, IsJSON, IsBoolean } from 'class-validator';
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
}
