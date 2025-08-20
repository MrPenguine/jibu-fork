import { fetchAPI, API_BASE_URL } from './api';
import { createClient } from './supabase/client';

export interface FileMetadata {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  storageProvider: string;
  storageKey: string;
  workspaceId: string;
  userId: string;
}

export interface FileResponse {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface FileListResponse {
  files: FileMetadata[];
  totalCount: number;
  pageSize: number;
  page: number;
}

/**
 * Convert raw file metadata to a structured FileResponse object
 */
export const formatFileResponse = (file: FileMetadata): FileResponse => {
  // Convert size from bytes to human-readable format
  const size = formatFileSize(file.sizeBytes);
  
  // Format the date
  const createdAt = new Date(file.createdAt).toLocaleString();
  
  return {
    id: file.id,
    name: file.name,
    size,
    type: file.mimeType,
    url: '#', // This will be replaced with a real URL when needed
    createdAt,
    metadata: {
      workspaceId: file.workspaceId,
      userId: file.userId,
      storageProvider: file.storageProvider
    }
  };
};

/**
 * Format bytes to a human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Get the currently active workspace ID using the most reliable method
 * @param specificWorkspaceId Optional workspace ID to override the auto-detection
 * @returns The workspace ID or null if none is found
 */
export function getActiveWorkspaceId(specificWorkspaceId?: string): string | null {
  // If a specific workspace ID is provided, use it
  if (specificWorkspaceId) {
    console.log('[getActiveWorkspaceId] Using explicitly provided workspace ID:', specificWorkspaceId);
    return specificWorkspaceId;
  }
  
  try {
    // First check if we're in the middle of a workspace switch
    if (typeof window !== 'undefined') {
      const switchInProgress = sessionStorage.getItem('workspaceSwitchInProgress') === 'true';
      const workspaceIdBeforeReload = sessionStorage.getItem('activeWorkspaceIdBeforeReload');
      
      if (switchInProgress && workspaceIdBeforeReload) {
        console.log('[getActiveWorkspaceId] Using workspace ID from in-progress switch (sessionStorage):', workspaceIdBeforeReload);
        return workspaceIdBeforeReload;
      }
    }
    
    // Direct check for workspace ID in session storage (for debugging)
    if (typeof window !== 'undefined') {
      const directWorkspaceId = sessionStorage.getItem('activeWorkspaceId');
      if (directWorkspaceId) {
        console.log('[getActiveWorkspaceId] Using workspace ID from sessionStorage:', directWorkspaceId);
        return directWorkspaceId;
      }
    }
    
    // Then try to get from localStorage
    if (typeof window !== 'undefined') {
      const storedWorkspaceId = localStorage.getItem('activeWorkspaceId');
      if (storedWorkspaceId) {
        console.log('[getActiveWorkspaceId] Using workspace ID from localStorage:', storedWorkspaceId);
        return storedWorkspaceId;
      }
    }
    
    // Do not return a default workspace ID - force explicit workspace selection
    console.warn('[getActiveWorkspaceId] No active workspace ID found in any storage, file operations will likely fail!');
    console.warn('[getActiveWorkspaceId] To fix this issue, please select a workspace or pass an explicit workspace ID.');
    return null;
  } catch (error) {
    console.error('[getActiveWorkspaceId] Error determining active workspace ID:', error);
    return null;
  }
}

/**
 * Sanitize a user ID to ensure it's a single string value, not an array
 * This addresses an issue where the userId is sometimes passed as an array to the backend
 */
function sanitizeUserId(userId: string): string {
  if (!userId) return '';
  // If userId contains commas, it might be duplicated - take the first value
  return userId.includes(',') ? userId.split(',')[0] : userId;
}

/**
 * Upload a file to the server
 * @param file The file to upload
 * @param onProgress Optional callback for upload progress
 * @param specificWorkspaceId Optional workspace ID to override the current one
 * @returns The uploaded file metadata
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void,
  specificWorkspaceId?: string
): Promise<FileResponse> {
  console.log(`Uploading file: ${file.name} (${file.size} bytes, type: ${file.type})`);
  
  return new Promise(async (resolve, reject) => {
    try {
      // Get Supabase session
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session. User must be authenticated to make this request.');
      }
      
      // Get user ID from session
      const { data: { user } } = await supabase.auth.getUser();
      let userId = user?.id;
      
      if (!userId) {
        throw new Error('Could not retrieve user ID from session.');
      }
      
      // Sanitize userId to prevent duplicate/array issues
      userId = sanitizeUserId(userId);
      
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      
      // Get the workspace ID using our helper function
      const workspaceId = getActiveWorkspaceId(specificWorkspaceId);
      
      if (!workspaceId) {
        console.error('[uploadFile] No workspace ID available. Upload will fail!');
        console.error('[uploadFile] specificWorkspaceId provided:', specificWorkspaceId);
        console.error('[uploadFile] localStorage workspace ID:', localStorage.getItem('activeWorkspaceId'));
        throw new Error('No active workspace selected. Please select a workspace first.');
      }
      
      console.log(`[uploadFile] File will be uploaded to workspace ID: ${workspaceId}`);
      console.log(`[uploadFile] File: ${file.name}, size: ${formatFileSize(file.size)}`);
      
      // Important: Use the field name 'file' as expected by the FileInterceptor in NestJS
      formData.append('file', file);
      
      // Setup progress tracking if provided
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });
      }
      
      // Setup completion handler
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            console.log('[uploadFile] Upload complete. Status:', xhr.status);
            console.log('[uploadFile] Response text:', xhr.responseText.substring(0, 200) + (xhr.responseText.length > 200 ? '...' : ''));
            
            const response = JSON.parse(xhr.responseText);
            
            // Verify the workspace ID in the response
            if (response.workspaceId && response.workspaceId !== workspaceId) {
              console.warn(`[uploadFile] Workspace ID mismatch! Expected: ${workspaceId}, Got: ${response.workspaceId}`);
            }
            
            // Create a file object from the response
            const fileObject: FileResponse = {
              id: response.id,
              name: response.name || file.name,
              size: formatFileSize(response.sizeBytes || file.size),
              type: response.mimeType || file.type,
              url: response.url || '',
              createdAt: response.createdAt || new Date().toISOString(),
              metadata: {
                storageProvider: response.storageProvider || 'local',
                userId: response.userId || userId,
                workspaceId: response.workspaceId || workspaceId,
              }
            };
            
            console.log('[uploadFile] Parsed file object:', fileObject);
            console.log('[uploadFile] File workspace ID:', fileObject.metadata?.workspaceId);
            resolve(fileObject);
          } catch (error) {
            console.error('[uploadFile] Error parsing upload response:', error);
            console.error('[uploadFile] Response text:', xhr.responseText);
            reject(new Error('Failed to parse server response'));
          }
        } else {
          console.error('[uploadFile] Upload failed. Status:', xhr.status);
          console.error('[uploadFile] Status text:', xhr.statusText);
          console.error('[uploadFile] Response:', xhr.responseText);
          
          // Try to parse error message from response if possible
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            const errorMessage = errorResponse.message || errorResponse.error || xhr.statusText || 'Server error';
            reject(new Error(`Upload failed: ${errorMessage}`));
          } catch (parseError) {
            reject(new Error(`Upload failed: ${xhr.statusText || 'Server error'}`));
          }
        }
      };
      
      // Setup error handler
      xhr.onerror = function() {
        console.error('Network error during upload');
        reject(new Error('Network error during upload'));
      };
      
      // Send the request
      // Add userId directly in the formData as well as query param
      const uploadUrl = `${API_BASE_URL}/files?workspaceId=${workspaceId}&userId=${userId}&_t=${Date.now()}`;
      console.log('[uploadFile] Upload URL:', uploadUrl);
      
      xhr.open('POST', uploadUrl);
      
      // Add Supabase auth token
      console.log('[uploadFile] Setting Authorization header with token');
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      
      // Add workspace ID and userId headers
      xhr.setRequestHeader('X-Workspace-ID', workspaceId);
      xhr.setRequestHeader('X-Force-Workspace-ID', workspaceId);
      xhr.setRequestHeader('X-User-ID', userId);
      // Don't set Content-Type for FormData - browser will handle this automatically with correct boundary
      
      // Add additional headers to prevent caching
      xhr.setRequestHeader('Cache-Control', 'no-cache, no-store');
      xhr.setRequestHeader('Pragma', 'no-cache');
      
      // Add userId and workspaceId to form data - do this only ONCE to avoid duplication
      formData.append('userId', userId);
      formData.append('workspaceId', workspaceId);
      // formData.append('organization', workspaceId); // This compatibility layer has been removed
      
      console.log('[uploadFile] Sending upload request with userId:', userId, 'and workspaceId:', workspaceId);
      xhr.send(formData);
    } catch (error) {
      console.error('Error preparing upload:', error);
      reject(error);
    }
  });
}

/**
 * List files for the current workspace
 * @param page Page number (1-indexed)
 * @param pageSize Number of items per page
 * @param specificWorkspaceId Optional workspace ID to override the current one
 * @returns Array of file metadata
 */
export async function listFiles(
  page: number = 1,
  pageSize: number = 50,
  specificWorkspaceId?: string
): Promise<FileResponse[]> {
  try {
    // Get the workspace ID using our helper function
    const workspaceId = getActiveWorkspaceId(specificWorkspaceId);
    
    if (!workspaceId) {
      console.warn('[listFiles] No active workspace selected. Cannot list files.');
      return [];
    }
    
    // Add a cache-busting timestamp to ensure fresh data
    const timestamp = Date.now();
    const fetchUrl = `/files?page=${page}&pageSize=${pageSize}&workspaceId=${workspaceId}&_t=${timestamp}`;
    console.log('[listFiles] Fetching files from:', fetchUrl);
    console.log('[listFiles] Using workspace ID:', workspaceId);
    
    // Add custom headers for extra workspace ID clarity
    const customOptions = {
      headers: {
        'X-Workspace-ID': workspaceId,
        'X-Force-Workspace-ID': workspaceId,
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      }
    };
    
    const response = await fetchAPI(fetchUrl, customOptions);
    console.log('[listFiles] Response from server:', response);
    
    // If the API returns the files in a data property, extract it
    const files = Array.isArray(response) ? response : (response.data || []);
    console.log('[listFiles] Parsed files array length:', files.length);
    
    if (files.length === 0) {
      console.log('[listFiles] No files found for workspace:', workspaceId);
    } else {
      console.log('[listFiles] First file workspace ID:', files[0]?.workspaceId || 'Unknown');
    }
    
    return files.map((file: any) => ({
      id: file.id,
      name: file.name,
      size: formatFileSize(file.sizeBytes || file.size || 0),
      type: file.mimeType || 'application/octet-stream',
      url: file.url || '',
      createdAt: file.createdAt || new Date().toISOString(),
      metadata: {
        workspaceId: file.workspaceId || workspaceId,
        userId: file.userId,
        storageProvider: file.storageProvider,
        ...(file.metadata || {})
      }
    }));
  } catch (error) {
    console.error('[listFiles] Error listing files:', error);
    throw error;
  }
}

/**
 * Get file metadata by ID
 * @param fileId File ID
 * @param specificWorkspaceId Optional workspace ID to override the current one
 * @returns The file metadata
 */
export async function getFile(fileId: string, specificWorkspaceId?: string): Promise<FileResponse> {
  try {
    // Get the workspace ID using our helper function
    const workspaceId = getActiveWorkspaceId(specificWorkspaceId);
    
    if (!workspaceId) {
      console.warn('[getFile] No active workspace selected.');
      throw new Error("No active workspace selected");
    }
    
    // Add cache busting parameter
    const timestamp = Date.now();
    const fetchUrl = `/files/${fileId}?workspaceId=${workspaceId}&_t=${timestamp}`;
    console.log('[getFile] Fetching file from:', fetchUrl);
    console.log('[getFile] Using workspace ID:', workspaceId);
    
    // Add custom headers
    const customOptions = {
      headers: {
        'X-Workspace-ID': workspaceId,
        'X-Force-Workspace-ID': workspaceId,
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      }
    };
    
    const fileData = await fetchAPI(fetchUrl, customOptions);
    console.log('[getFile] File data retrieved:', fileData?.id);
    
    return {
      id: fileData.id,
      name: fileData.name,
      size: formatFileSize(fileData.sizeBytes || 0),
      type: fileData.mimeType || 'application/octet-stream',
      url: fileData.url || '',
      createdAt: fileData.createdAt || new Date().toISOString(),
      metadata: {
        workspaceId: fileData.workspaceId || workspaceId,
        userId: fileData.userId,
        storageProvider: fileData.storageProvider,
        ...(fileData.metadata || {})
      }
    };
  } catch (error) {
    console.error('[getFile] Error getting file:', error);
    throw error;
  }
}

/**
 * Get a download URL for a file
 * @param fileId File ID
 * @param specificWorkspaceId Optional workspace ID to override the current one
 * @returns A download URL for the file
 */
export async function getDownloadUrl(fileId: string, specificWorkspaceId?: string): Promise<string> {
  try {
    // Get the workspace ID using our helper function
    const workspaceId = getActiveWorkspaceId(specificWorkspaceId);
    
    if (!workspaceId) {
      console.warn('[getDownloadUrl] No active workspace selected.');
      throw new Error("No active workspace selected");
    }
    
    // Add cache busting parameter
    const timestamp = Date.now();
    const fetchUrl = `/files/${fileId}/download?workspaceId=${workspaceId}&_t=${timestamp}`;
    console.log('[getDownloadUrl] Getting download URL from:', fetchUrl);
    console.log('[getDownloadUrl] Using workspace ID:', workspaceId);
    
    // Add custom headers
    const customOptions = {
      headers: {
        'X-Workspace-ID': workspaceId,
        'X-Force-Workspace-ID': workspaceId,
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      }
    };
    
    const response = await fetchAPI(fetchUrl, customOptions);
    console.log('[getDownloadUrl] Successfully retrieved download URL');
    return response.downloadUrl || response.url;
  } catch (error) {
    console.error('[getDownloadUrl] Error getting download URL:', error);
    throw error;
  }
}

/**
 * Delete a file
 * @param fileId File ID
 * @param specificWorkspaceId Optional workspace ID to override the current one
 * @param specificUserId Optional user ID to override the current one
 */
export async function deleteFile(fileId: string, specificWorkspaceId?: string, specificUserId?: string): Promise<void> {
  try {
    // Get the workspace ID using our helper function
    const workspaceId = getActiveWorkspaceId(specificWorkspaceId);
    
    if (!workspaceId) {
      console.warn('[deleteFile] No active workspace selected.');
      throw new Error("No active workspace selected");
    }
    
    // Get the user ID from Supabase session
    let userId = specificUserId;
    
    if (!userId) {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
      
      if (!userId) {
        console.error('[deleteFile] No user ID available. User must be authenticated.');
        throw new Error('User must be authenticated to delete files');
      }
    }
    
    // Sanitize userId to prevent duplicate/array issues
    userId = sanitizeUserId(userId);
    
    // Add cache busting parameter and userId
    const timestamp = Date.now();
    const fetchUrl = `/files/${fileId}?workspaceId=${workspaceId}&userId=${userId}&_t=${timestamp}`;
    console.log('[deleteFile] Deleting file at:', fetchUrl);
    console.log('[deleteFile] Using workspace ID:', workspaceId);
    console.log('[deleteFile] Using user ID:', userId);
    
    // Add custom headers
    const customOptions = {
      method: 'DELETE',
      headers: {
        'X-Workspace-ID': workspaceId,
        'X-Force-Workspace-ID': workspaceId,
        'X-User-ID': userId,
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      }
    };
    
    await fetchAPI(fetchUrl, customOptions);
    console.log('[deleteFile] File deleted successfully');
  } catch (error) {
    console.error('[deleteFile] Error deleting file:', error);
    throw error;
  }
} 