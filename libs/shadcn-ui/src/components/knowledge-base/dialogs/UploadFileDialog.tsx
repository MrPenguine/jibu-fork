"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { useDropzone } from "react-dropzone";

export interface UploadFilePayload {
  files: File[];
  chunkingStrategy?: string;
  folderId?: string;
}

interface UploadFileDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (payload: UploadFilePayload) => void;
}

export function UploadFileDialog({ open, onOpenChange, onImport }: UploadFileDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [chunkingStrategy, setChunkingStrategy] = useState<string | undefined>();
  const [folderId, setFolderId] = useState<string | undefined>();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      setFiles(acceptedFiles);
    },
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    }
  });

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setChunkingStrategy(undefined);
      setFolderId(undefined);
    }
  }, [open]);

  const handleImport = () => {
    onImport({ files, chunkingStrategy, folderId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Import file</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-2">
          {/* File Dropzone */}
          <div className="grid gap-2">
            <Label htmlFor="kb-files">File(s)</Label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300'}`}>
              <input {...getInputProps()} />
              <p className="text-slate-500">Drop file(s) here or</p>
              <Button variant="outline" className="mt-2">Browse</Button>
            </div>
            <p className="text-sm text-slate-500">Supported file types: pdf, txt, docx - 10mb max.</p>
            {files.length > 0 && (
              <div className="text-sm text-slate-600">
                Selected: {files.map((f) => f.name).join(", ")}
              </div>
            )}
          </div>

          {/* LLM Chunking Strategy */}
          <div className="grid gap-2">
            <Label htmlFor="kb-chunking-strategy">LLM chunking strategy</Label>
            <Select value={chunkingStrategy} onValueChange={setChunkingStrategy}>
              <SelectTrigger id="kb-chunking-strategy">
                <SelectValue placeholder="Select strategy (optional)" />
              </SelectTrigger>
              <SelectContent>
                {/* Add strategy options here */}
              </SelectContent>
            </Select>
          </div>

          {/* Folder */}
          <div className="grid gap-2">
            <Label htmlFor="kb-folder">Folder</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger id="kb-folder">
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All data sources</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={files.length === 0}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
