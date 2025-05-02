"use client"

import React, { useState, useEffect } from 'react'
import { FileUploadArea } from '@libs/shadcn-ui/components/organization/FileUploadArea'
import { FileList } from '@libs/shadcn-ui/components/organization/FileList'
import { Button } from '@libs/shadcn-ui/components/ui/button'
import { Upload, Download, Link, Trash, FileIcon } from 'lucide-react'
import { useToast } from '@libs/shadcn-ui/components/ui/use-toast'
import { Card } from '@libs/shadcn-ui/components/ui/card'
import * as fileApi from '../../../../utils/fileApi'
import { Progress } from '@libs/shadcn-ui/components/ui/progress'

export default function FilePage() {
  const { toast } = useToast()
  
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

  // Log component mounting
  useEffect(() => {
    console.log('File page component mounted');
    fetchFiles();
    
    // Log the active organization ID
    try {
      const orgId = localStorage.getItem('activeOrganizationId');
      console.log('Active organization ID:', orgId);
    } catch (error) {
      console.error('Error reading localStorage:', error);
    }
  }, []);

  // Function to fetch files from the API
  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching files...');
      
      const filesList = await fileApi.listFiles();
      console.log('Files fetched:', filesList);
      
      setFiles(filesList);
      setHasFiles(filesList.length > 0);
      
      // Select the first file if available and none is currently selected
      if (filesList.length > 0 && !selectedFile) {
        console.log('Setting selected file to first file');
        setSelectedFile(filesList[0]);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: "Failed to load files. Please try again.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  // Function to handle file upload
  const handleFileUpload = async (file: File) => {
    try {
      console.log('Handling file upload:', file.name);
      setIsUploading(true);
      setUploadProgress(0);
      
      const uploadedFile = await fileApi.uploadFile(file, (progress: number) => {
        console.log(`Upload progress: ${progress}%`);
        setUploadProgress(progress);
      });
      
      console.log('File uploaded successfully:', uploadedFile);
      
      setFiles(prevFiles => [uploadedFile, ...prevFiles]);
      setSelectedFile(uploadedFile);
      setHasFiles(true);
      setIsUploading(false);
      
      toast({
        title: "Success",
        description: `${file.name} has been uploaded successfully.`,
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload Failed",
        description: `There was an error uploading your file: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
      setIsUploading(false);
    }
  };

  // Function to handle file deletion
  const handleDeleteFile = async () => {
    if (!selectedFile) return;
    
    try {
      console.log('Deleting file:', selectedFile.id);
      setIsDeleting(true);
      await fileApi.deleteFile(selectedFile.id);
      
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
      
      setIsDeleting(false);
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast({
        title: "Delete Failed",
        description: `There was an error deleting your file: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
      setIsDeleting(false);
    }
  };

  // Function to get and copy download URL
  const copyUrlToClipboard = async () => {
    if (!selectedFile) return;
    
    try {
      console.log('Getting download URL for file:', selectedFile.id);
      const downloadUrl = await fileApi.getDownloadUrl(selectedFile.id);
      console.log('Download URL:', downloadUrl);
      
      navigator.clipboard.writeText(downloadUrl);
      toast({
        title: "URL copied to clipboard",
        description: "The file URL has been copied to your clipboard.",
      });
    } catch (error: any) {
      console.error('Error getting download URL:', error);
      toast({
        title: "Error",
        description: `Failed to get download URL: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  // Function to handle download
  const handleDownload = async () => {
    if (!selectedFile) return;
    
    try {
      console.log('Downloading file:', selectedFile.id);
      const downloadUrl = await fileApi.getDownloadUrl(selectedFile.id);
      console.log('Opening download URL:', downloadUrl);
      window.open(downloadUrl, '_blank');
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast({
        title: "Download Failed",
        description: `There was an error downloading your file: ${error?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

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
    <div className="h-screen flex flex-col p-0">
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Files section with upload button */}
        <div className="w-[350px] border-r border-gray-200 flex flex-col p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold">Documents ({files.length})</h2>
            <Button
              variant="outline"
              size="sm"
              className="bg-primary/10 hover:bg-primary/20 text-primary flex items-center gap-1.5"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={isUploading}
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="text-xs">Upload</span>
            </Button>
            <input
              id="file-upload"
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
              type: file.type
            }))} 
            selectedFileId={selectedFile?.id} 
            onSelectFile={(id) => {
              const file = files.find(f => f.id === id);
              if (file) {
                setSelectedFile(file);
              }
            }}
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
