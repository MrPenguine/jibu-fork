import { IsString, IsBoolean, IsOptional, IsNumber, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Voice metadata for voice messages
 */
export class VoiceMetadataDto {
  @ApiProperty({
    description: 'Speech recognition confidence (0.0-1.0)',
    example: 0.95,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @ApiProperty({
    description: 'Detected language code',
    example: 'en-US',
  })
  @IsString()
  language: string;

  @ApiProperty({
    description: 'Audio duration in milliseconds',
    example: 3500,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  duration: number;
}

/**
 * DTO for sending a message to an existing conversation
 */
export class SendMessageDto {
  @ApiProperty({
    description: 'Session ID of the conversation',
    example: 'session_123abc',
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'Message text content',
    example: 'Hello, I need help with my order',
  })
  @IsString()
  text: string;

  @ApiPropertyOptional({
    description: 'Whether this is a voice message',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isVoice?: boolean;

  @ApiPropertyOptional({
    description: 'Voice metadata (required if isVoice is true)',
    type: VoiceMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => VoiceMetadataDto)
  voiceMetadata?: VoiceMetadataDto;

  @ApiPropertyOptional({
    description: 'User ID (optional)',
    example: 'user_456def',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
