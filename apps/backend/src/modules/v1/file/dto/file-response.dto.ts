import { Exclude, Expose, Type } from 'class-transformer';
import { IsString, IsInt, IsDate, IsOptional, ValidateNested } from 'class-validator';

export class UserInfoDto {
  @Expose()
  @IsString()
  id: string;

  @Expose()
  @IsString()
  @IsOptional()
  firstName?: string;

  @Expose()
  @IsString()
  @IsOptional()
  lastName?: string;

  @Expose()
  @IsString()
  @IsOptional()
  email?: string;
}

export class FileResponseDto {
  @Expose()
  @IsString()
  id: string;

  @Expose()
  @IsString()
  name: string;

  @Expose()
  @IsString()
  mimeType: string;

  @Expose()
  @IsInt()
  sizeBytes: number;

  @Expose()
  @IsString()
  organizationId: string;

  @Expose()
  @IsString()
  userId: string;

  @Expose()
  @ValidateNested()
  @Type(() => UserInfoDto)
  @IsOptional()
  uploader?: UserInfoDto;

  @Expose()
  @IsDate()
  createdAt: Date;

  // Exclude sensitive fields
  @Exclude()
  storageProvider: string;

  @Exclude()
  storageKey: string;

  @Exclude()
  updatedAt: Date;
} 