import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class CreateCredentialDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;
} 