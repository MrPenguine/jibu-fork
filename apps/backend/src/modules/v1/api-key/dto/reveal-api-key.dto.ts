import { IsOptional, IsString } from 'class-validator';

export class RevealApiKeyDto {
  @IsOptional()
  @IsString()
  password?: string;
}
