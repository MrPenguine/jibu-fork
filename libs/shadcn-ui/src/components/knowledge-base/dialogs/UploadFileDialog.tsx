"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Input } from "../../ui/input";
import { useDropzone, type FileRejection } from "react-dropzone";
import { ChunkingStrategySelect, type ChunkingStrategyKey } from "../ChunkingStrategySelect";

export interface UploadFilePayload {
  files: File[];
  chunkingStrategy?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  folderId?: string;
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

interface UploadFileDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (payload: UploadFilePayload) => void;
  folders?: { id: string; name: string }[];
  onOpenCreateFolder?: () => void;
  preselectedFolderId?: string;
}

export function UploadFileDialog({ open, onOpenChange, onImport, folders = [], onOpenCreateFolder, preselectedFolderId }: UploadFileDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [chunking, setChunking] = useState<ChunkingStrategyKey[]>([]);
  const [folderId, setFolderId] = useState<string | undefined>();
  const [chunkSize, setChunkSize] = useState<number>(DEFAULT_CHUNK_SIZE);
  const [chunkOverlap, setChunkOverlap] = useState<number>(DEFAULT_CHUNK_OVERLAP);

  const [rejected, setRejected] = useState<string[]>([]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setFiles(acceptedFiles);
      setRejected((fileRejections || []).map((r) => r.file?.name).filter(Boolean));
    },
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md', '.markdown'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    }
  });

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setChunking([]);
      setFolderId(undefined);
      setRejected([]);
      setChunkSize(DEFAULT_CHUNK_SIZE);
      setChunkOverlap(DEFAULT_CHUNK_OVERLAP);
    } else if (preselectedFolderId) {
      // Set the preselected folder when dialog opens
      setFolderId(preselectedFolderId);
    }
  }, [open, preselectedFolderId]);

  useEffect(() => {
    console.log('[UploadFileDialog] Folders prop updated:', folders);
  }, [folders]);

  const handleFolderChange = (value: string) => {
    console.log('[UploadFileDialog] Folder selected:', value);
    setFolderId(value);
  };

  const handleImport = () => {
    console.log('[UploadFileDialog] Importing with folderId:', folderId);
    console.log('[UploadFileDialog] Available folders:', folders);
    onImport({ files, chunkingStrategy: chunking.join(","), chunkSize, chunkOverlap, folderId });
  };

  const usesSmart = chunking.includes("smart" as ChunkingStrategyKey);

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
            <p className="text-sm text-slate-500">Supported file types: pdf, txt, md, csv, docx - 10mb max.</p>
            {files.length > 0 && (
              <div className="text-sm text-slate-600">
                Selected: {files.map((f) => f.name).join(", ")}
              </div>
            )}
            {rejected.length > 0 && (
              <div className="text-sm text-red-600">
                Unsupported and skipped: {rejected.join(", ")}
              </div>
            )}
          </div>

          {/* LLM Chunking Strategy */}
          <div className="grid gap-2">
            <Label htmlFor="kb-chunking-strategy">LLM chunking strategy</Label>
            <ChunkingStrategySelect value={chunking} onChange={setChunking} />
          </div>

          {/* Chunk size / overlap */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="kb-chunk-size">Chunk size (chars)</Label>
              <Input
                id="kb-chunk-size"
                type="number"
                min={100}
                max={8000}
                step={100}
                value={chunkSize}
                disabled={usesSmart}
                onChange={(e) => setChunkSize(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kb-chunk-overlap">Chunk overlap (chars)</Label>
              <Input
                id="kb-chunk-overlap"
                type="number"
                min={0}
                max={2000}
                step={50}
                value={chunkOverlap}
                disabled={usesSmart}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
              />
            </div>
            {usesSmart && (
              <p className="col-span-2 text-xs text-slate-500">
                Smart chunking groups by topic and ignores size/overlap.
              </p>
            )}
          </div>

          {/* Folder */}
          <div className="grid gap-2">
            <Label htmlFor="kb-folder">Folder ({folders?.length || 0} available)</Label>
            <Select value={folderId} onValueChange={handleFolderChange}>
              <SelectTrigger id="kb-folder">
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                {folders && folders.length > 0 ? (
                  folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No folders available</div>
                )}
              </SelectContent>
            </Select>
            <button
              type="button"
              className="self-start text-sm text-blue-600 hover:underline"
              onClick={() => onOpenCreateFolder?.()}
            >
              Create folder
            </button>
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
