import { Readable } from 'node:stream';

/**
 * Interface defining storage service operations
 */
export const IStorageService = Symbol('IStorageService');

export interface IStorageService {
  /**
   * Upload a file to storage
   * @param key Unique identifier for the file
   * @param buffer File content as a buffer
   * @param mimeType MIME type of the file
   * @param orgId Organization ID
   * @returns Promise with upload result containing URL, key, and optionally versionId
   */
  upload(
    key: string,
    buffer: Buffer | Uint8Array,
    mimeType: string,
    orgId: string
  ): Promise<{
    url: string;
    key: string;
    versionId?: string;
  }>;

  /**
   * Get a readable stream for a file
   * @param key File key
   * @param orgId Organization ID
   * @returns Promise with readable stream of the file content
   */
  getFileStream(key: string, orgId: string): Promise<Readable>;

  /**
   * Generate a signed URL for downloading a file
   * @param key File key
   * @param orgId Organization ID
   * @param expiresIn Expiration time in seconds (default 3600)
   * @returns Promise with the signed URL
   */
  getSignedDownloadUrl(
    key: string,
    orgId: string,
    expiresIn?: number
  ): Promise<string>;

  /**
   * Delete a file from storage
   * @param key File key
   * @param orgId Organization ID
   */
  delete(key: string, orgId: string): Promise<void>;

  /**
   * Check if the storage service is properly connected
   * @returns Promise with boolean indicating connection status
   */
  checkConnection(): Promise<boolean>;
} 