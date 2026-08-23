import { IsArray, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsInt()
  @IsPositive()
  expiresIn?: number;
}