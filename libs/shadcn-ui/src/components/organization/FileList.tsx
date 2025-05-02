"use client"

import React from 'react'
import { File, FileText, FileSpreadsheet } from 'lucide-react'

interface FileItem {
  id: string
  name: string
  type: string
}

interface FileListProps {
  files: FileItem[]
  selectedFileId?: string
  onSelectFile?: (fileId: string) => void
}

export function FileList({ files, selectedFileId, onSelectFile }: FileListProps) {
  if (!files || files.length === 0) {
    return null
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
        {files.map((file) => (
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