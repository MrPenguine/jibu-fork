import { IsString, IsOptional, IsArray, IsObject, ValidateNested, IsUUID, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { FlowNode, FlowEdge } from '../../../../../../../libs/src';

export class UpdateAgentDto {
  @IsString()
  @IsOptional()
  name?: string;

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

  @IsUUID()
  @IsOptional()
  assistantId?: string;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
