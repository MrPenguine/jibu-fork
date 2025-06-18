import { IsString, IsOptional, IsArray, IsObject, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { FlowNode, FlowEdge } from '../../../../../../../libs/src';

export class CreateAgentDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  nodes: FlowNode[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  edges: FlowEdge[];

  @IsString()
  @IsOptional()
  startNodeId?: string;

  @IsUUID()
  @IsOptional()
  assistantId?: string;
}
