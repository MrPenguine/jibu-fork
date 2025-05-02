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
 * Upload a file to the server
 * @param file The file to upload
 * @param onProgress Optional callback for upload progress
 * @returns The uploaded file metadata
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void
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
      
      // Get the organization ID from localStorage
      let orgId = null;
      try {
        orgId = localStorage.getItem('activeOrganizationId');
        console.log('Using organization ID for upload:', orgId);
      } catch (error) {
        console.error('Error reading localStorage:', error);
      }
      
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
 * @returns Array of file metadata
 */
export async function listFiles(
  page: number = 1,
  pageSize: number = 50
): Promise<FileResponse[]> {
  try {
    // Get the organization ID from localStorage
    let orgId = null;
    try {
      orgId = localStorage.getItem('activeOrganizationId');
      console.log('Using organization ID for listing files:', orgId);
    } catch (error) {
      console.error('Error reading localStorage:', error);
    }
    
    if (!orgId) {
      console.warn('No active organization selected. Cannot list files.');
      return [];
    }
    
    const fetchUrl = `/files?page=${page}&pageSize=${pageSize}&orgId=${orgId}`;
    console.log('Fetching files from:', fetchUrl);
    
    const response = await fetchAPI(fetchUrl);
    console.log('List files response:', response);
    
    // If the API returns the files in a data property, extract it
    const files = Array.isArray(response) ? response : (response.data || []);
    console.log('Parsed files array:', files);
    
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
    console.error('Error listing files:', error);
    return [];
  }
}

/**
 * Get a single file by ID
 * @param fileId The ID of the file to get
 * @returns File metadata
 */
export async function getFile(fileId: string): Promise<FileResponse> {
  console.log('Getting file details for:', fileId);
  
  // Get the organization ID from localStorage
  let orgId = null;
  try {
    orgId = localStorage.getItem('activeOrganizationId');
    console.log('Using organization ID for file details:', orgId);
  } catch (error) {
    console.error('Error reading localStorage:', error);
  }
  
  if (!orgId) {
    throw new Error('No active organization selected. Please select an organization first.');
  }
  
  const response = await fetchAPI(`/files/${fileId}?orgId=${orgId}`);
  console.log('Get file response:', response);
  
  return {
    id: response.id,
    name: response.name,
    size: formatFileSize(response.sizeBytes || 0),
    type: response.mimeType || 'application/octet-stream',
    url: response.url || '',
    createdAt: response.createdAt || new Date().toISOString(),
    metadata: response.metadata || {}
  };
}

/**
 * Get a download URL for a file
 * @param fileId The ID of the file to download
 * @returns URL to download the file
 */
export async function getDownloadUrl(fileId: string): Promise<string> {
  console.log('Getting download URL for file:', fileId);
  
  // Get the organization ID from localStorage
  let orgId = null;
  try {
    orgId = localStorage.getItem('activeOrganizationId');
    console.log('Using organization ID for download URL:', orgId);
  } catch (error) {
    console.error('Error reading localStorage:', error);
  }
  
  if (!orgId) {
    throw new Error('No active organization selected. Please select an organization first.');
  }
  
  const response = await fetchAPI(`/files/${fileId}/download?orgId=${orgId}`);
  console.log('Download URL response:', response);
  
  // The response might be an object with a URL property or a direct string URL
  return response.downloadUrl || response;
}

/**
 * Delete a file
 * @param fileId The ID of the file to delete
 */
export async function deleteFile(fileId: string): Promise<void> {
  console.log('Deleting file:', fileId);
  
  // Get the organization ID from localStorage
  let orgId = null;
  try {
    orgId = localStorage.getItem('activeOrganizationId');
    console.log('Using organization ID for file deletion:', orgId);
  } catch (error) {
    console.error('Error reading localStorage:', error);
  }
  
  if (!orgId) {
    throw new Error('No active organization selected. Please select an organization first.');
  }
  
  // Get user ID from session
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  
  if (!userId) {
    throw new Error('Could not retrieve user ID from session.');
  }
  
  await fetchAPI(`/files/${fileId}?orgId=${orgId}&userId=${userId}`, { method: 'DELETE' });
  console.log('File deleted successfully');
} 