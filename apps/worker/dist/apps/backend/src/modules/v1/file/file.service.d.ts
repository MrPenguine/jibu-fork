import { PrismaService } from '../../../core/database/prisma.service';
import { IStorageService } from '../../../integrations/storage/interfaces/storage.interface';
import { FileResponseDto } from './dto/file-response.dto';
import { ListFilesDto } from './dto/list-files.dto';
interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}
export declare class FileService {
    private readonly prisma;
    private readonly storageService;
    private readonly logger;
    constructor(prisma: PrismaService, storageService: IStorageService);
    uploadAndCreateFileMetadata(workspaceId: string, userId: string, file: MulterFile): Promise<FileResponseDto>;
    findFilesByWorkspace(workspaceId: string, paginationOptions?: {
        page?: number;
        pageSize?: number;
    }): Promise<ListFilesDto>;
    findFileById(fileId: string, workspaceId: string): Promise<FileResponseDto>;
    getFileMetadataForDownload(fileId: string, workspaceId: string): Promise<{
        storageKey: string;
        name: string;
    }>;
    getDownloadUrl(fileId: string, workspaceId: string): Promise<string>;
    deleteFile(fileId: string, workspaceId: string, userId: string, isAdmin?: boolean): Promise<void>;
}
export {};
