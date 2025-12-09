export declare class UserInfoDto {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
}
export declare class FileResponseDto {
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    organizationId: string;
    userId: string;
    uploader?: UserInfoDto;
    createdAt: Date;
    storageProvider: string;
    storageKey: string;
    updatedAt: Date;
}
