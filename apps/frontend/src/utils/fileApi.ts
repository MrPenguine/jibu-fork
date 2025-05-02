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
  organizationId: string;
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
    metadata: undefined
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
 * Get the currently active organization ID using the most reliable method
 * @param specificOrgId Optional organization ID to override the auto-detection
 * @returns The organization ID or null if none is found
 */
export function getActiveOrgId(specificOrgId?: string): string | null {
  // If a specific org ID is provided, use it
  if (specificOrgId) {
    console.log('[getActiveOrgId] Using explicitly provided organization ID:', specificOrgId);
    return specificOrgId;
  }
  
  try {
    // First check if we're in the middle of an org switch
    if (typeof window !== 'undefined') {
      const switchInProgress = sessionStorage.getItem('orgSwitchInProgress') === 'true';
      const orgIdBeforeReload = sessionStorage.getItem('activeOrgIdBeforeReload');
      
      if (switchInProgress && orgIdBeforeReload) {
        console.log('[getActiveOrgId] Using org ID from in-progress switch (sessionStorage):', orgIdBeforeReload);
        return orgIdBeforeReload;
      }
    }
    
    // Direct check for organization ID in session storage (for debugging)
    if (typeof window !== 'undefined') {
      const directOrgId = sessionStorage.getItem('activeOrganizationId');
      if (directOrgId) {
        console.log('[getActiveOrgId] Using organization ID from sessionStorage:', directOrgId);
        return directOrgId;
      }
    }
    
    // Then try to get from localStorage
    if (typeof window !== 'undefined') {
      const storedOrgId = localStorage.getItem('activeOrganizationId');
      if (storedOrgId) {
        console.log('[getActiveOrgId] Using organization ID from localStorage:', storedOrgId);
        return storedOrgId;
      }
    }
    
    // Do not return a default organization ID - force explicit organization selection
    console.warn('[getActiveOrgId] No active organization ID found in any storage.');
    return null;
  } catch (error) {
    console.error('[getActiveOrgId] Error determining active organization ID:', error);
    return null;
  }
}

/**
 * Upload a file to the server
 * @param file The file to upload
 * @param onProgress Optional callback for upload progress
 * @param specificOrgId Optional organization ID to override the current one
 * @returns The uploaded file metadata
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void,
  specificOrgId?: string
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
      const userId = user?.id;
      
      if (!userId) {
        throw new Error('Could not retrieve user ID from session.');
      }
      
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      
      // Get the organization ID using our helper function
      const orgId = getActiveOrgId(specificOrgId);
      
      if (!orgId) {
        throw new Error('No active organization selected. Please select an organization first.');
      }
      
      // Important: Use the field name 'file' as expected by the FileInterceptor in NestJS
      formData.append('file', file);
      
      // Add metadata to the form as well
      formData.append('userId', userId);
      formData.append('organizationId', orgId);
      
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
            console.log('Upload complete. Status:', xhr.status);
            console.log('Response text:', xhr.responseText.substring(0, 200) + (xhr.responseText.length > 200 ? '...' : ''));
            
            const response = JSON.parse(xhr.responseText);
            
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
              }
            };
            
            console.log('Parsed file object:', fileObject);
            resolve(fileObject);
          } catch (error) {
            console.error('Error parsing upload response:', error);
            console.error('Response text:', xhr.responseText);
            reject(new Error('Failed to parse server response'));
          }
        } else {
          console.error('Upload failed. Status:', xhr.status);
          console.error('Status text:', xhr.statusText);
          console.error('Response:', xhr.responseText);
          reject(new Error(`Status text: "${xhr.statusText}"`));
        }
      };
      
      // Setup error handler
      xhr.onerror = function() {
        console.error('Network error during upload');
        reject(new Error('Network error during upload'));
      };
      
      // Send the request
      // Add userId directly in the formData as well as query param
      const uploadUrl = `${API_BASE_URL}/files?orgId=${orgId}&userId=${userId}`;
      console.log('Upload URL:', uploadUrl);
      
      xhr.open('POST', uploadUrl);
      
      // Add Supabase auth token
      console.log('Setting Authorization header with token');
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      
      // Add organization ID and userId headers
      if (orgId) {
        xhr.setRequestHeader('X-Organization-ID', orgId);
      }
      
      // Add user ID header explicitly 
      xhr.setRequestHeader('X-User-ID', userId);
      
      // Also add userId to form data as a fallback
      formData.append('userId', userId);
      formData.append('organizationId', orgId);
      
      console.log('Sending upload request with userId:', userId);
      xhr.send(formData);
    } catch (error) {
      console.error('Error preparing upload:', error);
      reject(error);
    }
  });
}

/**
 * List files for the current organization
 * @param page Page number (1-indexed)
 * @param pageSize Number of items per page
 * @param specificOrgId Optional organization ID to override the current one
 * @returns Array of file metadata
 */
export async function listFiles(
  page: number = 1,
  pageSize: number = 50,
  specificOrgId?: string
): Promise<FileResponse[]> {
  try {
    // Get the organization ID using our helper function
    const orgId = getActiveOrgId(specificOrgId);
    
    if (!orgId) {
      console.warn('[listFiles] No active organization selected. Cannot list files.');
      return [];
    }
    
    // Add a cache-busting timestamp to ensure fresh data
    const timestamp = Date.now();
    const fetchUrl = `/files?page=${page}&pageSize=${pageSize}&orgId=${orgId}&_t=${timestamp}`;
    console.log('[listFiles] Fetching files from:', fetchUrl);
    console.log('[listFiles] Using organization ID:', orgId);
    
    // Add custom headers for extra org ID clarity
    const customOptions = {
      headers: {
        'X-Organization-ID': orgId,
        'X-Force-Organization-ID': orgId,
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
      console.log('[listFiles] No files found for organization:', orgId);
    } else {
      console.log('[listFiles] First file organization ID:', files[0]?.organizationId || 'Unknown');
    }
    
    return files.map((file: any) => ({
      id: file.id,
      name: file.name,
      size: formatFileSize(file.sizeBytes || file.size || 0),
      type: file.mimeType || 'application/octet-stream',
      url: file.url || '',
      createdAt: file.createdAt || new Date().toISOString(),
      metadata: file.metadata || {}
    }));
  } catch (error) {
    console.error('[listFiles] Error listing files:', error);
    throw error;
  }
}

/**
 * Get file metadata by ID
 * @param fileId File ID
 * @param specificOrgId Optional organization ID to override the current one
 * @returns The file metadata
 */
export async function getFile(fileId: string, specificOrgId?: string): Promise<FileResponse> {
  try {
    // Get the organization ID using our helper function
    const orgId = getActiveOrgId(specificOrgId);
    
    if (!orgId) {
      console.warn('[getFile] No active organization selected.');
      throw new Error("No active organization selected");
    }
    
    // Add cache busting parameter
    const timestamp = Date.now();
    const fetchUrl = `/files/${fileId}?orgId=${orgId}&_t=${timestamp}`;
    console.log('[getFile] Fetching file from:', fetchUrl);
    console.log('[getFile] Using organization ID:', orgId);
    
    // Add custom headers
    const customOptions = {
      headers: {
        'X-Organization-ID': orgId,
        'X-Force-Organization-ID': orgId,
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
      metadata: fileData.metadata || {}
    };
  } catch (error) {
    console.error('[getFile] Error getting file:', error);
    throw error;
  }
}

/**
 * Get a download URL for a file
 * @param fileId File ID
 * @param specificOrgId Optional organization ID to override the current one
 * @returns A download URL for the file
 */
export async function getDownloadUrl(fileId: string, specificOrgId?: string): Promise<string> {
  try {
    // Get the organization ID using our helper function
    const orgId = getActiveOrgId(specificOrgId);
    
    if (!orgId) {
      console.warn('[getDownloadUrl] No active organization selected.');
      throw new Error("No active organization selected");
    }
    
    // Add cache busting parameter
    const timestamp = Date.now();
    const fetchUrl = `/files/${fileId}/download?orgId=${orgId}&_t=${timestamp}`;
    console.log('[getDownloadUrl] Getting download URL from:', fetchUrl);
    console.log('[getDownloadUrl] Using organization ID:', orgId);
    
    // Add custom headers
    const customOptions = {
      headers: {
        'X-Organization-ID': orgId,
        'X-Force-Organization-ID': orgId,
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
 * @param specificOrgId Optional organization ID to override the current one
 */
export async function deleteFile(fileId: string, specificOrgId?: string): Promise<void> {
  try {
    // Get the organization ID using our helper function
    const orgId = getActiveOrgId(specificOrgId);
    
    if (!orgId) {
      console.warn('[deleteFile] No active organization selected.');
      throw new Error("No active organization selected");
    }
    
    // Add cache busting parameter
    const timestamp = Date.now();
    const fetchUrl = `/files/${fileId}?orgId=${orgId}&_t=${timestamp}`;
    console.log('[deleteFile] Deleting file at:', fetchUrl);
    console.log('[deleteFile] Using organization ID:', orgId);
    
    // Add custom headers
    const customOptions = {
      method: 'DELETE',
      headers: {
        'X-Organization-ID': orgId,
        'X-Force-Organization-ID': orgId,
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