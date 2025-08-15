"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FileUploadArea } from '@libs/shadcn-ui/components/file/FileUploadArea'
import { FileList } from '@libs/shadcn-ui/components/file/FileList'
import { Button } from '@libs/shadcn-ui/components/ui/button'
import { Upload, Download, Link, Trash, FileIcon } from 'lucide-react'
import { useToast } from '@libs/shadcn-ui/components/ui/use-toast'
import { Card } from '@libs/shadcn-ui/components/ui/card'
import * as fileApi from '../../../../utils/fileApi'
import { Progress } from '@libs/shadcn-ui/components/ui/progress'
import { useOrganization } from '../../../../utils/organizationContext'
import { createClient } from '../../../../utils/supabase/client'

/**
 * Sanitize a user ID to ensure it's a single string value, not an array
 */
function sanitizeUserId(userId: string | undefined): string {
  if (!userId) return '';
  // If userId contains commas, it might be duplicated - take the first value
  return userId.includes(',') ? userId.split(',')[0] : userId;
}

export default function FilePage() {
  const { toast } = useToast()
  const { activeOrganization } = useOrganization()
  const refreshTimestamp = useRef(Date.now()).current
  
  // State to track if any files have been uploaded
  const [hasFiles, setHasFiles] = useState(false)
  
  // State to track files list
  const [files, setFiles] = useState<fileApi.FileResponse[]>([])
  
  // State to track the selected file
  const [selectedFile, setSelectedFile] = useState<fileApi.FileResponse | null>(null)
  
  // State for tracking upload progress
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  
  // State for tracking loading states
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Add a forceRefresh state to explicitly trigger re-renders
  const [forceRefresh, setForceRefresh] = useState(Date.now())

  // Define fetchFiles as useCallback to avoid recreating it on each render
  const fetchFiles = useCallback(async (orgId?: string) => {
    if (!orgId) {
      console.log('No organization ID provided for fetchFiles, skipping');
      setIsLoading(false);
      setFiles([]);
      setHasFiles(false);
      setSelectedFile(null);
      return;
    }

    try {
      setIsLoading(true);
      console.log(`[FETCH_FILES] Fetching files for organization: ${orgId}`);
      
      // Force-pass the specific organization ID, bypassing any cached values
      const filesList = await fileApi.listFiles(1, 50, orgId);
      console.log(`[FETCH_FILES] Files fetched for org ${orgId}:`, filesList);
      
      // Add additional validation to ensure organization IDs match
      const matchingFiles = filesList.filter(file => {
        const fileOrgId = file.metadata?.organizationId;
        const matches = fileOrgId === orgId;
        if (!matches) {
          console.warn(`[FETCH_FILES] Found file with mismatched organization ID: ${file.id}, belongs to ${fileOrgId} but current org is ${orgId}`);
        }
        return matches;
      });
      
      console.log(`[FETCH_FILES] After filtering: ${matchingFiles.length} of ${filesList.length} files belong to org ${orgId}`);
      
      // Only set files that match the current organization
      setFiles(matchingFiles);
      setHasFiles(matchingFiles.length > 0);
      
      // Select the first file if available and none is currently selected
      if (matchingFiles.length > 0) {
        console.log('[FETCH_FILES] Setting selected file to first file');
        setSelectedFile(matchingFiles[0]);
      } else {
        console.log('[FETCH_FILES] No files found for this organization');
        setSelectedFile(null);
      }
    } catch (error) {
      console.error(`[FETCH_FILES] Error fetching files for org ${orgId}:`, error);
      toast({
        title: "Error",
        description: "Failed to load files. Please try again.",
        variant: "destructive"
      });
      // Clear files on error
      setFiles([]);
      setHasFiles(false);
      setSelectedFile(null);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Force a rerender whenever the organization changes
  useEffect(() => {
    console.log(`[COMPONENT] FilePage fully remounting for organization: ${activeOrganization?.id}`);
    setForceRefresh(Date.now());
  }, [activeOrganization?.id]);

  // Effect to watch for organization changes - this will be triggered by forceRefresh updates now
  useEffect(() => {
    if (!activeOrganization?.id) {
      console.log('[ORG_CHANGE] No active organization, clearing files');
      setFiles([]);
      setSelectedFile(null);
      setHasFiles(false);
      setIsLoading(false);
      return;
    }
    
    console.log(`[ORG_CHANGE] Active organization changed: ${activeOrganization.name} (${activeOrganization.id})`);
    
    // Reset states
    setSelectedFile(null);
    setFiles([]);
    setHasFiles(false);
    
    // Fetch files for the new organization
    fetchFiles(activeOrganization.id);
    
  }, [activeOrganization?.id, fetchFiles, forceRefresh]);

  // Function to handle file upload
  const handleFileUpload = async (file: File) => {
    if (!activeOrganization?.id) {
      toast({
        title: "Error",
        description: "Please select an organization before uploading files.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log(`[UPLOAD] Uploading file: ${file.name} to organization: ${activeOrganization.id} (${activeOrganization.name})`);
      setIsUploading(true);
      setUploadProgress(0);
      
      // Pass the active organization ID directly
      const uploadedFile = await fileApi.uploadFile(file, (progress: number) => {
        console.log(`[UPLOAD] Upload progress: ${progress}%`);
        setUploadProgress(progress);
      }, activeOrganization.id);
      
      console.log('[UPLOAD] File uploaded successfully:', uploadedFile);
      console.log('[UPLOAD] File organization ID:', uploadedFile.metadata?.organizationId);
      
      setFiles(prevFiles => [uploadedFile, ...prevFiles]);
      setSelectedFile(uploadedFile);
      setHasFiles(true);
      
      toast({
        title: "Success",
        description: `${file.name} has been uploaded successfully to ${activeOrganization.name}.`,
      });
      
      // Refresh the file list to ensure consistency
      fetchFiles(activeOrganization.id);
    } catch (error: any) {
      console.error('[UPLOAD] Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: `There was an error uploading your file: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Function to handle file deletion
  const handleDeleteFile = async () => {
    if (!selectedFile || !activeOrganization?.id) return;
    
    try {
      console.log(`[DELETE] Deleting file: ${selectedFile.id} from organization: ${activeOrganization.id}`);
      setIsDeleting(true);
      
      // Get current user ID from Supabase session
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const userId = data?.user?.id;
        
        if (!userId) {
          console.error('[DELETE] No user ID available. User must be authenticated.');
          toast({
            title: "Authentication Error",
            description: "You must be logged in to delete files.",
            variant: "destructive"
          });
          setIsDeleting(false);
          return;
        }
        
        console.log(`[DELETE] Using user ID: ${userId}`);
        
        // Explicitly pass the organization ID and user ID
        await fileApi.deleteFile(selectedFile.id, activeOrganization.id, sanitizeUserId(userId));
      } catch (authError) {
        console.error('[DELETE] Error getting user:', authError);
        toast({
          title: "Authentication Error",
          description: "Failed to verify your identity. Please try logging in again.",
          variant: "destructive"
        });
        setIsDeleting(false);
        return;
      }
      
      // Update files list
      const updatedFiles = files.filter(file => file.id !== selectedFile.id);
      setFiles(updatedFiles);
      
      // Update selected file
      if (updatedFiles.length > 0) {
        setSelectedFile(updatedFiles[0]);
      } else {
        setSelectedFile(null);
        setHasFiles(false);
      }
      
      toast({
        title: "Success",
        description: "File has been deleted successfully.",
      });
    } catch (error: any) {
      console.error('[DELETE] Error deleting file:', error);
      toast({
        title: "Delete Failed",
        description: `There was an error deleting your file: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Function to get and copy download URL
  const copyUrlToClipboard = async () => {
    if (!selectedFile || !activeOrganization?.id) return;
    
    try {
      console.log(`[COPY_URL] Getting download URL for file: ${selectedFile.id} from organization: ${activeOrganization.id}`);
      
      // Explicitly pass the organization ID
      const downloadUrl = await fileApi.getDownloadUrl(selectedFile.id, activeOrganization.id);
      
      console.log('[COPY_URL] Download URL:', downloadUrl);
      
      navigator.clipboard.writeText(downloadUrl);
      toast({
        title: "URL copied to clipboard",
        description: "The file URL has been copied to your clipboard.",
      });
    } catch (error: any) {
      console.error('[COPY_URL] Error getting download URL:', error);
      toast({
        title: "Error",
        description: `Failed to get download URL: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  // Function to handle download
  const handleDownload = async () => {
    if (!selectedFile || !activeOrganization?.id) return;
    
    try {
      console.log(`[DOWNLOAD] Downloading file: ${selectedFile.id} from organization: ${activeOrganization.id}`);
      
      // Explicitly pass the organization ID
      const downloadUrl = await fileApi.getDownloadUrl(selectedFile.id, activeOrganization.id);
      
      console.log('[DOWNLOAD] Opening download URL:', downloadUrl);
      window.open(downloadUrl, '_blank');
    } catch (error: any) {
      console.error('[DOWNLOAD] Error downloading file:', error);
      toast({
        title: "Download Failed",
        description: `There was an error downloading your file: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  // If no organization is selected
  if (!activeOrganization) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="max-w-md text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-gray-600 mb-4">
            Please select an organization from the organization switcher to view and manage files.
          </p>
        </div>
      </div>
    );
  }

  // If loading, show a loading state
  if (isLoading && !isUploading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading files...</p>
      </div>
    );
  }

  // If no files, show only the upload area
  if (!hasFiles) {
    return (
      <div className="container-fluid p-0 h-screen flex items-center justify-center">
        <div className="max-w-lg w-full">
          <FileUploadArea 
            onFileUpload={(file: File) => {
              if (file) {
                handleFileUpload(file);
              }
            }}
            organizationName={activeOrganization?.name}
            organizationId={activeOrganization?.id}
          />
          
          {isUploading && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">Uploading {uploadProgress}%</p>
              <Progress value={uploadProgress} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col p-0" key={`file-page-container-${activeOrganization?.id}-${forceRefresh}`}>
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Files section with upload button */}
        <div className="w-[350px] border-r border-gray-200 flex flex-col p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold">Documents ({files.length})</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-gray-50 hover:bg-gray-100 text-gray-500 flex items-center gap-1.5"
                onClick={() => {
                  console.log('[MANUAL_REFRESH] User triggered manual refresh');
                  setForceRefresh(Date.now());
                  fetchFiles(activeOrganization?.id);
                }}
                disabled={isLoading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLoading ? 'animate-spin' : undefined}>
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                  <path d="M16 21h5v-5"></path>
                </svg>
                <span className="text-xs sr-only">Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-primary/10 hover:bg-primary/20 text-primary flex items-center gap-1.5"
                onClick={() => document.getElementById(`file-upload-${activeOrganization?.id || 'default'}`)?.click()}
                disabled={isUploading}
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="text-xs">Upload</span>
              </Button>
            </div>
            <input
              id={`file-upload-${activeOrganization?.id || 'default'}`}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                }
              }}
            />
          </div>
          
          {isUploading && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Uploading {uploadProgress}%</p>
              <Progress value={uploadProgress} className="h-1" />
            </div>
          )}
          
          <FileList 
            files={files.map(file => ({
              id: file.id,
              name: file.name,
              type: file.type,
              organizationId: file.metadata?.organizationId || activeOrganization?.id
            }))}
            selectedFileId={selectedFile?.id}
            onSelectFile={(fileId) => {
              const file = files.find(f => f.id === fileId);
              setSelectedFile(file || null);
            }}
            organizationId={activeOrganization?.id}
          />
        </div>
        
        {/* Main content area - File preview */}
        <div className="flex-1 overflow-auto p-6 bg-white">
          {selectedFile && (
            <Card className="max-w-4xl mx-auto p-6 shadow-sm">
              <div className="flex justify-center items-center mb-6 bg-primary/5 p-8 rounded-xl">
                <div className="text-center">
                  <div className="mx-auto w-[120px] h-[140px] bg-[#8259f4] rounded-lg relative flex items-center justify-center mb-4 shadow-md">
                    <div className="absolute top-0 right-0 w-0 h-0 border-t-[25px] border-t-white border-l-[25px] border-l-transparent transform rotate-90" />
                    <span className="font-bold text-black text-2xl">
                      {selectedFile.type.includes('pdf') ? 'PDF' : 
                       selectedFile.type.includes('doc') ? 'DOC' : 
                       selectedFile.type.includes('image') ? 'IMG' : 'FILE'}
                    </span>
                  </div>
                  <p className="text-center text-gray-800 font-medium text-lg mt-3">{selectedFile.name}</p>
                </div>
              </div>
              
              <div className="mt-4">
                <h2 className="text-base font-medium text-gray-900 mb-2">Filename</h2>
                <p className="text-gray-800 font-medium">{selectedFile.name}</p>
                <p className="text-sm text-gray-500 mt-1">{selectedFile.type} • {selectedFile.size}</p>
              </div>
              
              <div className="flex gap-3 mt-8">
                <Button 
                  variant="default"
                  size="default"
                  className="bg-[#8259f4] hover:bg-[#8259f4]/90"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                
                <Button 
                  variant="outline"
                  size="default"
                  onClick={copyUrlToClipboard}
                >
                  <Link className="h-4 w-4" />
                  Copy URL
                </Button>
                
                <Button 
                  variant="outline"
                  size="default"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 ml-auto"
                  onClick={handleDeleteFile}
                  disabled={isDeleting}
                >
                  <Trash className="h-4 w-4" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </Card>
          )}
        </div>
        
        {/* Right sidebar - File metadata */}
        <div className="w-[400px] p-4 overflow-y-auto border-l border-gray-200 bg-gray-50">
          <div className="mb-6">
            <h3 className="text-xs text-gray-500 mb-2">ID</h3>
            <div className="text-sm text-gray-700 p-2 rounded bg-white border border-gray-200 break-all font-mono">
              {selectedFile?.id || 'N/A'}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xs text-gray-500 mb-2">Organization</h3>
            <div className="text-sm text-gray-700 p-2 rounded bg-white border border-gray-200">
              {activeOrganization.name} ({activeOrganization.id.substring(0, 8)}...)
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-xs text-gray-500 mb-2">Metadata</h3>
            <div className="text-sm text-gray-700 p-2 rounded bg-white border border-gray-200">
              {selectedFile?.metadata ? JSON.stringify(selectedFile.metadata, null, 2) : 'No metadata available'}
            </div>
          </div>
          
          <div>
            <h3 className="text-xs text-gray-500 mb-2">Created At</h3>
            <div className="text-sm text-gray-700 p-2 rounded bg-white border border-gray-200">
              {selectedFile?.createdAt || 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
