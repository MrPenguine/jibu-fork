import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInvitationDto {
  @ApiProperty({
    description: 'Email address of the person to invite',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'ID of the organization to invite the user to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({
    description: 'Role to assign to the invited user',
    example: 'MEMBER',
    enum: ['MEMBER', 'ADMIN', 'OWNER'],
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({
    description: 'Optional message to include with the invitation',
    example: 'Please join our organization!',
    required: false,
  })
  @IsString()
  @IsOptional()
  message?: string;
}
