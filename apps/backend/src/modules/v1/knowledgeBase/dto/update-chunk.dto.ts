import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateChunkDto {
  @ApiProperty({ description: 'New chunk text; triggers a re-embed' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ description: 'Workspace ID', required: false })
  @IsOptional()
  @IsString()
  workspaceId?: string;
}

export class RetrieveTestDto {
  @ApiProperty({ description: 'Question to run against the knowledge base' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ description: 'Workspace ID', required: false })
  @IsOptional()
  @IsString()
  workspaceId?: string;
}
