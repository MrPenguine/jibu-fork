import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class TokenDto {
  @ApiProperty({
    description: 'JWT token for LiveKit authentication',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'LiveKit server URL',
    example: 'ws://localhost:7880',
  })
  @IsString()
  @IsNotEmpty()
  url: string;
}
