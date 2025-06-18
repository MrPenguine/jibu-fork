import { IsObject, IsOptional, IsString } from 'class-validator';

export class ExecuteAgentDto {
  @IsObject()
  @IsOptional()
  initialVariables?: Record<string, any>;

  @IsString()
  @IsOptional()
  chatId?: string;

  @IsString()
  @IsOptional()
  callSid?: string;
}
