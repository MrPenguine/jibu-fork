"use strict";
var S3StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3StorageService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let S3StorageService = S3StorageService_1 = class S3StorageService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(S3StorageService_1.name);
        this.region = this.configService.get('AWS_S3_REGION');
        this.bucketName = this.configService.get('AWS_S3_BUCKET_NAME');
        if (!this.region) {
            this.logger.error('AWS_S3_REGION not configured');
            throw new Error('AWS_S3_REGION must be configured for S3StorageService');
        }
        if (!this.bucketName) {
            this.logger.error('AWS_S3_BUCKET_NAME not configured');
            throw new Error('AWS_S3_BUCKET_NAME must be configured for S3StorageService');
        }
        try {
            const { S3Client } = require('@aws-sdk/client-s3');
            this.s3Client = new S3Client({
                region: this.region,
                credentials: {
                    accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
                    secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
                },
            });
            this.logger.log(`S3StorageService initialized with bucket: ${this.bucketName} in region: ${this.region}`);
        }
        catch (error) {
            this.logger.error(`Failed to initialize S3 client: ${error.message}`, error.stack);
            throw new Error(`Failed to initialize S3 client: ${error.message}`);
        }
    }
    async upload(key, buffer, mimeType, orgId) {
        const s3Key = key.startsWith(`files/${orgId}/`) ? key : `files/${orgId}/${key}`;
        this.logger.log(`Uploading file to S3 for organization ${orgId}`);
        this.logger.log(`Original key: ${key}, S3 key with organization path: ${s3Key}`);
        this.logger.log(`Content type: ${mimeType}, Size: ${buffer.byteLength} bytes`);
        try {
            const { PutObjectCommand } = require('@aws-sdk/client-s3');
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
                Body: buffer,
                ContentType: mimeType,
                Metadata: {
                    'organization-id': orgId,
                    'upload-timestamp': new Date().toISOString()
                }
            });
            const response = await this.s3Client.send(command);
            const s3Url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;
            this.logger.log(`Successfully uploaded file to S3: ${s3Key}`);
            this.logger.log(`Organization ID: ${orgId}, Version ID: ${response.VersionId || 'none'}`);
            return {
                url: s3Url,
                key: s3Key,
                versionId: response.VersionId,
            };
        }
        catch (error) {
            this.logger.error(`Failed to upload file to S3 for organization ${orgId}: ${error.message}`, error.stack);
            throw new Error(`S3 upload failed: ${error.message}`);
        }
    }
    async getFileStream(key, orgId) {
        const s3Key = key.startsWith(`files/${orgId}/`) ? key : `files/${orgId}/${key}`;
        this.logger.log(`Getting file stream for key: ${s3Key}`);
        try {
            const { GetObjectCommand } = require('@aws-sdk/client-s3');
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
            });
            const response = await this.s3Client.send(command);
            if (!response.Body) {
                throw new Error(`No body in S3 response for key: ${s3Key}`);
            }
            return response.Body;
        }
        catch (error) {
            if (error.name === 'NoSuchKey') {
                this.logger.warn(`File not found in S3: ${s3Key}`);
                throw new Error(`File not found: ${key}`);
            }
            this.logger.error(`Failed to get file stream from S3: ${error.message}`, error.stack);
            throw new Error(`Failed to get file from S3: ${error.message}`);
        }
    }
    async getSignedDownloadUrl(key, orgId, expiresIn = 3600) {
        const s3Key = key.startsWith(`files/${orgId}/`) ? key : `files/${orgId}/${key}`;
        this.logger.log(`Generating signed URL for key: ${s3Key}`);
        try {
            const { GetObjectCommand } = require('@aws-sdk/client-s3');
            const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
            });
            const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
            this.logger.log(`Generated signed URL for ${s3Key}, expires in ${expiresIn}s`);
            return signedUrl;
        }
        catch (error) {
            this.logger.error(`Failed to generate signed URL: ${error.message}`, error.stack);
            throw new Error(`Failed to generate signed URL: ${error.message}`);
        }
    }
    async delete(key, orgId) {
        const s3Key = key.startsWith(`files/${orgId}/`) ? key : `files/${orgId}/${key}`;
        this.logger.log(`Deleting file with key: ${s3Key}`);
        try {
            const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
            });
            await this.s3Client.send(command);
            this.logger.log(`Successfully deleted file from S3: ${s3Key}`);
        }
        catch (error) {
            this.logger.error(`Failed to delete file from S3: ${error.message}`, error.stack);
            throw new Error(`Failed to delete file from S3: ${error.message}`);
        }
    }
    async checkConnection() {
        try {
            this.logger.log(`Testing connection to S3 bucket: ${this.bucketName} in region: ${this.region}`);
            const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
            const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
            if (!accessKeyId || !secretAccessKey) {
                this.logger.error('AWS credentials are missing. Check environment variables AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
                return false;
            }
            const { HeadBucketCommand } = require('@aws-sdk/client-s3');
            const command = new HeadBucketCommand({
                Bucket: this.bucketName,
            });
            await this.s3Client.send(command);
            this.logger.log(`Successfully connected to S3 bucket: ${this.bucketName}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to connect to S3 bucket: ${error.message}`, error.stack);
            const errorCode = error.name || error.code;
            if (errorCode === 'NoSuchBucket') {
                this.logger.error(`Bucket ${this.bucketName} does not exist`);
            }
            else if (errorCode === 'AccessDenied' || errorCode === 'ForbiddenException') {
                this.logger.error(`Access denied to bucket ${this.bucketName}. Check IAM permissions.`);
            }
            else if (errorCode === 'NetworkingError') {
                this.logger.error(`Network error connecting to S3. Check internet connection and AWS region.`);
            }
            return false;
        }
    }
};
exports.S3StorageService = S3StorageService;
exports.S3StorageService = S3StorageService = S3StorageService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [config_1.ConfigService])
], S3StorageService);
//# sourceMappingURL=s3-storage.service.js.map