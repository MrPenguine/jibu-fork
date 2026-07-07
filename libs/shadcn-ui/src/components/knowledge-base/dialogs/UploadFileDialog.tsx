"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Input } from "../../ui/input";
import { useDropzone, type FileRejection } from "react-dropzone";
import { ChunkingStrategySelect, type ChunkingStrategyKey } from "../ChunkingStrategySelect";
import { Upload, FolderPlus } from "lucide-react";

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
      <DialogContent className="sm:max-w-[560px] rounded-2xl border-0 bg-white p-0 shadow-2xl overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-primary to-emerald-600 px-6 py-5 text-white">
          <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import file
          </DialogTitle>
          <DialogDescription className="text-emerald-50">
            Upload PDF, TXT, DOCX, CSV, or Markdown files to add to the knowledge base.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 px-6 py-5">
          {/* File Dropzone */}
          <div className="grid gap-2">
            <Label htmlFor="kb-files" className="text-slate-700 font-medium">File(s)</Label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-emerald-50' : 'border-slate-200 hover:border-primary/50 bg-slate-50/50'}`}>
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-xl bg-emerald-50 p-3 text-primary">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-slate-600 font-medium">Drop file(s) here or click to browse</p>
                <p className="text-xs text-slate-400">PDF, TXT, MD, CSV, DOCX — up to 10 MB</p>
              </div>
            </div>
            {files.length > 0 && (
              <div className="text-sm text-slate-700 bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                Selected: <span className="font-medium">{files.map((f) => f.name).join(", ")}</span>
              </div>
            )}
            {rejected.length > 0 && (
              <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3 border border-red-100">
                Unsupported and skipped: {rejected.join(", ")}
              </div>
            )}
          </div>

          {/* LLM Chunking Strategy */}
          <div className="grid gap-2">
            <Label htmlFor="kb-chunking-strategy" className="text-slate-700 font-medium">LLM chunking strategy</Label>
            <ChunkingStrategySelect value={chunking} onChange={setChunking} />
          </div>

          {/* Chunk size / overlap */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="kb-chunk-size" className="text-slate-700 font-medium">Chunk size (chars)</Label>
              <Input
                id="kb-chunk-size"
                type="number"
                min={100}
                max={8000}
                step={100}
                value={chunkSize}
                disabled={usesSmart}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="rounded-xl border-slate-200 focus-visible:ring-primary"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kb-chunk-overlap" className="text-slate-700 font-medium">Chunk overlap (chars)</Label>
              <Input
                id="kb-chunk-overlap"
                type="number"
                min={0}
                max={2000}
                step={50}
                value={chunkOverlap}
                disabled={usesSmart}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
                className="rounded-xl border-slate-200 focus-visible:ring-primary"
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
            <Label htmlFor="kb-folder" className="text-slate-700 font-medium">Folder ({folders?.length || 0} available)</Label>
            <Select value={folderId} onValueChange={handleFolderChange}>
              <SelectTrigger id="kb-folder" className="rounded-xl border-slate-200">
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {folders && folders.length > 0 ? (
                  folders.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="rounded-lg">{f.name}</SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">No folders available</div>
                )}
              </SelectContent>
            </Select>
            <button
              type="button"
              className="self-start text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
              onClick={() => onOpenCreateFolder?.()}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Create folder
            </button>
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-slate-200">Cancel</Button>
          <Button onClick={handleImport} disabled={files.length === 0} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
