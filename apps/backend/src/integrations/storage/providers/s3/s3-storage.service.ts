import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  HeadBucketCommand 
} from '@aws-sdk/client-s3';
import type { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageService } from '../../interfaces/storage.interface';
import type { Readable } from 'stream';

/**
 * Implementation of IStorageService using AWS S3
 * This version doesn't use the dependencies directly but defines the types
 * to avoid import errors during build. The actual implementations will be loaded dynamically.
 */
@Injectable()
export class S3StorageService implements IStorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: any; // S3Client
  private readonly bucketName: string;
  private readonly region: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.region = this.configService.get<string>('AWS_S3_REGION');
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');

    if (!this.region) {
      this.logger.error('AWS_S3_REGION not configured');
      throw new Error('AWS_S3_REGION must be configured for S3StorageService');
    }

    if (!this.bucketName) {
      this.logger.error('AWS_S3_BUCKET_NAME not configured');
      throw new Error('AWS_S3_BUCKET_NAME must be configured for S3StorageService');
    }

    // Initialize S3 client dynamically to avoid import errors
    try {
      // Dynamic import of AWS SDK to avoid build errors
      const { S3Client } = require('@aws-sdk/client-s3');

      // Initialize S3 client with the AWS SDK v3
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
        },
      });

      this.logger.log(`S3StorageService initialized with bucket: ${this.bucketName} in region: ${this.region}`);
    } catch (error) {
      this.logger.error(`Failed to initialize S3 client: ${error.message}`, error.stack);
      throw new Error(`Failed to initialize S3 client: ${error.message}`);
    }
  }

  /**
   * Upload a file to S3
   */
  async upload(
    key: string,
    buffer: Buffer | Uint8Array,
    mimeType: string,
    orgId: string,
  ): Promise<{ url: string; key: string; versionId?: string }> {
    // Use a consistent format for the S3 key using the new path structure
    const s3Key = key.startsWith(`files/${orgId}/`) ? key : `files/${orgId}/${key}`;
    
    this.logger.log(`Uploading file with key: ${s3Key}`);

    try {
      // Dynamic import of PutObjectCommand to avoid build errors
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
      });

      const response = await this.s3Client.send(command);

      // Construct the URL
      const s3Url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;

      this.logger.log(`Successfully uploaded file to S3: ${s3Key}`);
      
      return {
        url: s3Url,
        key: s3Key,
        versionId: response.VersionId,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`, error.stack);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Get a readable stream for a file from S3
   */
  async getFileStream(key: string, orgId: string): Promise<Readable> {
    // Check if the key already contains the files/orgId prefix
    const s3Key = key.startsWith(`files/${orgId}/`) ? key : `files/${orgId}/${key}`;
    
    this.logger.log(`Getting file stream for key: ${s3Key}`);

    try {
      // Dynamic import of GetObjectCommand to avoid build errors
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error(`No body in S3 response for key: ${s3Key}`);
      }
      
      return response.Body as Readable;
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        this.logger.warn(`File not found in S3: ${s3Key}`);
        throw new Error(`File not found: ${key}`);
      }
      
      this.logger.error(`Failed to get file stream from S3: ${error.message}`, error.stack);
      throw new Error(`Failed to get file from S3: ${error.message}`);
    }
  }

  /**
   * Generate a signed URL for downloading a file from S3
   */
  async getSignedDownloadUrl(
    key: string, 
    orgId: string, 
    expiresIn: number = 3600
  ): Promise<string> {
    // Check if the key already contains the files/orgId prefix
    const s3Key = key.startsWith(`files/${orgId}/`) ? key : `files/${orgId}/${key}`;
    
    this.logger.log(`Generating signed URL for key: ${s3Key}`);

    try {
      // Dynamic import of required modules to avoid build errors
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      
      this.logger.log(`Generated signed URL for ${s3Key}, expires in ${expiresIn}s`);
      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL: ${error.message}`, error.stack);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Delete a file from S3
   */
  async delete(key: string, orgId: string): Promise<void> {
    // Check if the key already contains the files/orgId prefix
    const s3Key = key.startsWith(`files/${orgId}/`) ? key : `files/${orgId}/${key}`;
    
    this.logger.log(`Deleting file with key: ${s3Key}`);

    try {
      // Dynamic import of DeleteObjectCommand to avoid build errors
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      await this.s3Client.send(command);
      this.logger.log(`Successfully deleted file from S3: ${s3Key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${error.message}`, error.stack);
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Check if the S3 connection is working properly
   */
  async checkConnection(): Promise<boolean> {
    try {
      this.logger.log(`Testing connection to S3 bucket: ${this.bucketName} in region: ${this.region}`);
      
      // First check if we have AWS credentials
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
      
      if (!accessKeyId || !secretAccessKey) {
        this.logger.error('AWS credentials are missing. Check environment variables AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
        return false;
      }
      
      // Dynamic import of HeadBucketCommand to avoid build errors
      const { HeadBucketCommand } = require('@aws-sdk/client-s3');
      
      const command = new HeadBucketCommand({
        Bucket: this.bucketName,
      });

      await this.s3Client.send(command);
      this.logger.log(`Successfully connected to S3 bucket: ${this.bucketName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to connect to S3 bucket: ${error.message}`, error.stack);
      
      // Check for specific AWS errors
      const errorCode = error.name || error.code;
      if (errorCode === 'NoSuchBucket') {
        this.logger.error(`Bucket ${this.bucketName} does not exist`);
      } else if (errorCode === 'AccessDenied' || errorCode === 'ForbiddenException') {
        this.logger.error(`Access denied to bucket ${this.bucketName}. Check IAM permissions.`);
      } else if (errorCode === 'NetworkingError') {
        this.logger.error(`Network error connecting to S3. Check internet connection and AWS region.`);
      }
      
      return false;
    }
  }
} 