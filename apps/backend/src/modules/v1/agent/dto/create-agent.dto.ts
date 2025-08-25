import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
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
  @IsOptional()
  nodes?: FlowNode[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  @IsOptional()
  edges?: FlowEdge[];

  @IsString()
  @IsOptional()
  startNodeId?: string;

}
