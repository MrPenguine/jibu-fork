import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';

/**
 * DTO for text-to-speech request
 */
export class TextToSpeechDto {
  @ApiProperty({
    description: 'The text to convert to speech',
    example: 'Hello, this is a test of the text-to-speech system.',
  })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({
    description: 'The ID of the voice to use',
    example: 'JBFqnCBsd6RMkjVDRZzb',
  })
  @IsString()
  @IsNotEmpty()
  voiceId: string;

  @ApiProperty({
    description: 'The model ID to use for synthesis (defaults to eleven_multilingual_v2)',
    example: 'eleven_multilingual_v2',
    required: false,
  })
  @IsString()
  @IsOptional()
  modelId?: string;

  @ApiProperty({
    description: 'Stability setting (0.0 to 1.0)',
    example: 0.5,
    minimum: 0,
    maximum: 1,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  stability?: number;

  @ApiProperty({
    description: 'Similarity boost setting (0.0 to 1.0)',
    example: 0.75,
    minimum: 0,
    maximum: 1,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  similarityBoost?: number;

  @ApiProperty({
    description: 'Style setting (0.0 to 1.0)',
    example: 0,
    minimum: 0,
    maximum: 1,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  style?: number;

  @ApiProperty({
    description: 'Whether to use speaker boost',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  speakerBoost?: boolean;
}
