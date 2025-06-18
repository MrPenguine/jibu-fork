import { Expose, Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { FileResponseDto } from './file-response.dto';

export class ListFilesDto {
  @Expose()
  @Type(() => FileResponseDto)
  data: FileResponseDto[];

  @Expose()
  @IsInt()
  total: number;

  @Expose()
  @IsInt()
  @IsOptional()
  page?: number;

  @Expose()
  @IsInt()
  @IsOptional()
  pageSize?: number;
} 