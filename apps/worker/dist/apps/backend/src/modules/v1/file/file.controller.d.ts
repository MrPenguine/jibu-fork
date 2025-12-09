import { FileService } from './file.service';
import { FileResponseDto } from './dto/file-response.dto';
import { ListFilesDto } from './dto/list-files.dto';
interface AuthenticatedRequest {
    user: {
        userId: string;
        email: string;
        workspaceId?: string;
        workspaceRole?: string;
    };
    headers: {
        [key: string]: string | string[];
    };
    body: any;
}
interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}
export declare class FileController {
    private readonly fileService;
    private readonly logger;
    constructor(fileService: FileService);
    private getWorkspaceId;
    private sanitizeUserId;
    uploadFile(file: MulterFile, bodyUserId: string, bodyWorkspaceId: string, queryWorkspaceId: string, headerWorkspaceId: string, forceWorkspaceId: string): Promise<FileResponseDto>;
    listFiles(req: AuthenticatedRequest, page?: string, pageSize?: string, queryWorkspaceId?: string): Promise<ListFilesDto>;
    getFileById(fileId: string, req: AuthenticatedRequest, queryWorkspaceId?: string, queryUserId?: string): Promise<FileResponseDto>;
    getDownloadUrl(fileId: string, req: AuthenticatedRequest, queryWorkspaceId?: string, queryUserId?: string): Promise<{
        downloadUrl: string;
    }>;
    deleteFile(fileId: string, req: AuthenticatedRequest, queryWorkspaceId?: string, queryUserId?: string, headerUserId?: string): Promise<void>;
}
export {};
