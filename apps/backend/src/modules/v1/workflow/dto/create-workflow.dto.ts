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
    description: 'ID of the assistant (agent) to associate with the workflow',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  assistantId: string;

  @ApiProperty({
    description: 'ID of the master workflow if creating a secondary workflow',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  masterWorkflowId?: string;

  @ApiProperty({
    description: 'Workspace ID that the workflow belongs to',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  workspaceId?: string;
}
