import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsOptional } from 'class-validator';

export class LinkFileSourceDto {
  @ApiProperty({
    description: 'ID of the file to link as a knowledge base source',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  fileId: string;
  
  @ApiProperty({
    description: 'Workspace ID that owns the knowledge base and file',
    example: 'f9c21618-9311-441b-a170-36eb41fbcbfa',
    required: false,
  })
  @IsString()
  @IsOptional()
  workspaceId?: string;

  @ApiProperty({
    description: 'Optional folder ID to associate the source with (supports UUID and CUID formats)',
    example: 'cmi5m9t9m0001v1xchem3dxdd',
    required: false,
  })
  @IsOptional()
  @IsString()
  folderId?: string;
}