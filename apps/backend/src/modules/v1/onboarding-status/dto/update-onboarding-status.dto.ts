import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateOnboardingStatusDto {
  @ApiProperty({
    description: 'Whether the user has created an agent',
    required: false,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  createdAgent?: boolean;

  @ApiProperty({
    description: 'Whether the user has added a tool',
    required: false,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  addedTool?: boolean;

  @ApiProperty({
    description: 'Whether the user has added a phone number',
    required: false,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  addedPhoneNumber?: boolean;

  @ApiProperty({
    description: 'Whether the user has run a test',
    required: false,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  ranTest?: boolean;
}
