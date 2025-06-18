"use client"

import React from 'react'
import { Download, Link, Trash, FileIcon } from 'lucide-react'
import { Button } from '@libs/shadcn-ui/components/ui/button'
import { useToast } from '@libs/shadcn-ui/components/ui/use-toast'

interface FileDetailsProps {
  file?: {
    id: string
    name: string
    size: string
    type: string
    url: string
    createdAt: string
    metadata?: Record<string, any>
  }
}

export function FileDetails({ file }: FileDetailsProps) {
  const { toast } = useToast()
  
  // Show success toast when a file is uploaded
  React.useEffect(() => {
    if (file) {
      toast({
        title: "File uploaded successfully",
        description: `${file.name} has been uploaded.`,
      })
    }
  }, [file?.id])

  if (!file) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-gray-500 text-sm">Select a file to view details</p>
      </div>
    )
  }

  const copyUrlToClipboard = () => {
    navigator.clipboard.writeText(file.url)
    toast({
      title: "URL copied to clipboard",
      description: "The file URL has been copied to your clipboard.",
    })
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* File preview */}
      <div className="w-full bg-gray-50 rounded-lg flex items-center justify-center p-8 mb-4">
        <div className="bg-white p-6 rounded-md shadow-sm">
          <FileIcon className="h-12 w-12 text-primary" />
        </div>
      </div>

      {/* File info */}
      <div className="w-full">
        <h2 className="text-lg font-semibold mb-1">{file.name}</h2>
        <p className="text-sm text-gray-500 mb-4">{file.size} • {file.type}</p>
        
        {/* Action buttons */}
        <div className="flex gap-2 mb-6">
          <Button 
            variant="default" 
            size="sm"
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1"
            onClick={copyUrlToClipboard}
          >
            <Link className="h-4 w-4" />
            Copy URL
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 ml-auto"
          >
            <Trash className="h-4 w-4" />
            Delete
          </Button>
        </div>

        {/* Metadata */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">File details</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-500">ID</div>
            <div className="font-mono text-xs overflow-hidden text-ellipsis">{file.id}</div>
            <div className="text-gray-500">Created</div>
            <div>{file.createdAt}</div>
            {file.metadata && Object.entries(file.metadata).map(([key, value]) => (
              <React.Fragment key={key}>
                <div className="text-gray-500">{key}</div>
                <div>{String(value)}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 