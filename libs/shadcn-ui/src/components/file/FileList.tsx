"use client"

import React, { useEffect } from 'react'
import { File, FileText, FileSpreadsheet, FolderClosed } from 'lucide-react'

interface FileItem {
  id: string
  name: string
  type: string
  organizationId?: string
}

interface FileListProps {
  files: FileItem[]
  selectedFileId?: string
  onSelectFile?: (fileId: string) => void
  organizationId?: string
}

export function FileList({ files, selectedFileId, onSelectFile, organizationId }: FileListProps) {
  // Filter files by organization ID if provided
  const filteredFiles = organizationId 
    ? files.filter(file => file.organizationId === organizationId)
    : files;
  
  // Add debug logging to help troubleshoot organization filtering
  useEffect(() => {
    if (organizationId) {
      console.log(`[FileList] Filtering files for organization: ${organizationId}`);
      console.log(`[FileList] Total files: ${files.length}, After filtering: ${filteredFiles.length}`);
      
      if (files.length > 0 && filteredFiles.length === 0) {
        console.log('[FileList] WARNING: No files match current organization ID. First few files:', 
          files.slice(0, 3).map(f => ({
            id: f.id,
            name: f.name,
            orgId: f.organizationId
          }))
        );
      }
    }
  }, [files, filteredFiles.length, organizationId]);
    
  if (!filteredFiles || filteredFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="bg-gray-100 rounded-full p-3 mb-2">
          <FolderClosed className="h-6 w-6 text-gray-400" />
        </div>
        <h3 className="text-sm font-medium text-gray-600">No files found</h3>
        <p className="text-xs text-gray-500 mt-1">
          Upload files to this organization to get started
        </p>
      </div>
    )
  }

  // Function to get the appropriate icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType.toLowerCase().includes('pdf')) {
      return <FileText className="h-5 w-5 text-primary" />
    }
    if (fileType.toLowerCase().includes('word') || fileType.toLowerCase().includes('doc')) {
      return <File className="h-5 w-5 text-blue-500" />
    }
    if (fileType.toLowerCase().includes('spreadsheet') || fileType.toLowerCase().includes('excel')) {
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />
    }
    return <File className="h-5 w-5 text-primary" />
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-2 pr-1">
        {filteredFiles.map((file) => (
          <div 
            key={file.id}
            onClick={() => onSelectFile?.(file.id)}
            className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
              selectedFileId === file.id 
                ? 'bg-primary/10 border-l-2 border-primary' 
                : 'hover:bg-gray-50 border-l-2 border-transparent'
            }`}
          >
            <div className={`p-2 rounded-lg mr-3 ${
              selectedFileId === file.id ? 'bg-primary/20' : 'bg-gray-100'
            }`}>
              {getFileIcon(file.type)}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{file.type}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 