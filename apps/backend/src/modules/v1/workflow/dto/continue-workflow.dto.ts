import { IsObject, IsOptional, IsString } from 'class-validator';

export class ContinueWorkflowDto {
  @IsString()
  @IsOptional()
  userInput?: string;

  @IsObject()
  @IsOptional()
  event?: Record<string, any>;
}
