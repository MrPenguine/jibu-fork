import { IsOptional, IsString, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSecondaryWorkflowDto {
  @ApiProperty({
    description: 'Name of the workflow',
    example: 'Secondary Customer Support Workflow',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Description of the workflow',
    example: 'A secondary workflow for handling specific customer support queries',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Flow nodes data as JSON (optional, inherits from master if not provided)',
    example: '{"node1": {"id": "node1", "type": "start"}}',
    required: false,
  })
  @IsJSON()
  @IsOptional()
  nodes?: Record<string, any>;

  @ApiProperty({
    description: 'Flow edges data as JSON (optional, inherits from master if not provided)',
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
}
