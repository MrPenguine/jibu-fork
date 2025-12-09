import { FileResponseDto } from './file-response.dto';
export declare class ListFilesDto {
    data: FileResponseDto[];
    total: number;
    page?: number;
    pageSize?: number;
}
