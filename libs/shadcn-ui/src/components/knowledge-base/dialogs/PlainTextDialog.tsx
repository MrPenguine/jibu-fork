"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";

export interface PlainTextPayload {
  text: string;
  chunkingStrategy?: string;
  folderId?: string;
}

interface PlainTextDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (payload: PlainTextPayload) => void;
}

export function PlainTextDialog({ open, onOpenChange, onImport }: PlainTextDialogProps) {
  const [text, setText] = useState("");
  const [chunkingStrategy, setChunkingStrategy] = useState<string | undefined>();
  const [folderId, setFolderId] = useState<string | undefined>();

  useEffect(() => {
    if (!open) {
      setText("");
      setChunkingStrategy(undefined);
      setFolderId(undefined);
    }
  }, [open]);

  const handleImport = () => {
    onImport({
      text: text.trim(),
      chunkingStrategy,
      folderId,
    });
  };

  const isValid = text.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Import text</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-2">
          {/* Content Textarea */}
          <div className="grid gap-2">
            <Label htmlFor="kb-content">Content</Label>
            <Textarea
              id="kb-content"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-32 resize-y"
              placeholder="Enter or paste text here..."
            />
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
          <Button onClick={handleImport} disabled={!isValid}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
