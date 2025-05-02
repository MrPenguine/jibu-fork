"use client"

import React, { useState } from 'react'
import { File, Upload, FileUp } from 'lucide-react'
import { Button } from '@libs/shadcn-ui/components/ui/button'

interface FileUploadAreaProps {
  onFileUpload?: (file: File) => void;
  compact?: boolean;
}

export function FileUploadArea({ onFileUpload, compact = false }: FileUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false)
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  
  const handleDragLeave = () => {
    setIsDragging(false)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    // Process the dropped file
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      onFileUpload?.(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      onFileUpload?.(file)
    }
  }
  
  return (
    <div className="w-full">
      <div className="flex items-center mb-3">
        <File className="h-5 w-5 mr-2 text-primary" />
        <h2 className="text-sm font-semibold">Files</h2>
      </div>
      
      <div
        className={`border border-dashed border-gray-300 rounded-xl ${compact ? 'p-4' : 'p-8'} flex flex-col items-center justify-center text-center transition-colors ${
          isDragging ? 'bg-primary/5 border-primary/30' : 'bg-white hover:bg-gray-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="bg-primary/10 p-3 rounded-full mb-3">
          <FileUp className="h-6 w-6 text-primary" />
        </div>
        
        {!compact && (
          <p className="text-sm text-gray-600 mb-3">
            Drag and drop a file here or browse files
          </p>
        )}
        
        <div className="flex gap-3 mt-2">
          <Button
            variant="default"
            size="sm"
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 h-auto rounded-xl flex items-center gap-2 shadow-sm"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload className="h-4 w-4" />
            {compact ? 'Choose File' : 'Browse Files'}
          </Button>
          {!compact && (
            <Button
              variant="outline"
              size="sm"
              className="bg-transparent rounded-xl border-gray-300 hover:bg-gray-50 px-4 py-2 h-auto text-gray-600"
            >
              Documentation
            </Button>
          )}
        </div>
        <input
          id="file-upload"
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      
      {!compact && (
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-2">Supported file types</h3>
          <ul className="text-xs text-gray-500 space-y-1 pl-1">
            <li>• PDF documents (up to 25MB)</li>
            <li>• Word documents (up to 25MB)</li>
            <li>• Text files (up to 10MB)</li>
            <li>• Spreadsheets (up to 25MB)</li>
          </ul>
          <p className="text-xs text-gray-500 mt-3">
            Upload files to provide additional context for your assistants during conversations.
          </p>
        </div>
      )}
    </div>
  )
} 