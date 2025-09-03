import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFolderDto {
  @ApiProperty({ description: 'The new name of the folder.', example: 'Updated Agent Folder', required: false })
  @IsString()
  @IsOptional()
  name?: string;
}
