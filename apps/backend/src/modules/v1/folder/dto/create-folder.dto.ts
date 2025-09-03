import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFolderDto {
  @ApiProperty({ description: 'The name of the folder.', example: 'My Favorite Agents' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
