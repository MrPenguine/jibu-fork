import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
} 