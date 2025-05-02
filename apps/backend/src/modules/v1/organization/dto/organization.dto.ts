import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty({ message: 'Organization name is required' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  name: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;
  
  @IsOptional()
  @IsEmail()
  email?: string;
  
  @IsOptional()
  settings?: Record<string, any>;
}

export class InviteMembersDto {
  @IsArray()
  @IsNotEmpty()
  emails: string[];
  
  @IsString()
  @IsNotEmpty()
  role: string;
  
  @IsOptional()
  @IsString()
  message?: string;
}

export class RespondToInvitationDto {
  @IsEnum(['accept', 'reject'])
  action: 'accept' | 'reject';
}

export class UpdateMemberRoleDto {
  @IsString()
  @IsNotEmpty()
  role: string;
}

export class TransferOwnershipDto {
  @IsString()
  @IsNotEmpty()
  newOwnerId: string;
} 