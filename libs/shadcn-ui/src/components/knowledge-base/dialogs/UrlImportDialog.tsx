"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";

export interface UrlImportPayload {
  urls: string[];
  refreshRate: string;
  chunkingStrategy?: string;
  folderId?: string;
}

interface UrlImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (payload: UrlImportPayload) => void;
}

export function UrlImportDialog({ open, onOpenChange, onImport }: UrlImportDialogProps) {
  const [urlsText, setUrlsText] = useState("");
  const [refreshRate, setRefreshRate] = useState("never");
  const [chunkingStrategy, setChunkingStrategy] = useState<string | undefined>();
  const [folderId, setFolderId] = useState<string | undefined>();

  useEffect(() => {
    if (!open) {
      setUrlsText("");
      setRefreshRate("never");
      setChunkingStrategy(undefined);
      setFolderId(undefined);
    }
  }, [open]);

  const urls = urlsText
    .split(/\n/)
    .map((u) => u.trim())
    .filter(Boolean);

  const handleImport = () => {
    onImport({
      urls,
      refreshRate,
      chunkingStrategy,
      folderId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Import from URL(s)</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-2">
          {/* URLs Input */}
          <div className="grid gap-2">
            <Label htmlFor="kb-urls">URL(s)</Label>
            <Textarea
              id="kb-urls"
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              className="h-24 resize-y"
              placeholder="Enter URL(s)"
            />
            <p className="text-sm text-slate-500">One url per line.</p>
          </div>

          {/* Refresh Rate */}
          <div className="grid gap-2">
            <Label htmlFor="kb-refresh-rate">Refresh rate</Label>
            <Select value={refreshRate} onValueChange={setRefreshRate}>
              <SelectTrigger id="kb-refresh-rate">
                <SelectValue placeholder="Select refresh rate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-slate-500">How often will the data source sync.</p>
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
          <Button onClick={handleImport} disabled={urls.length === 0}>
            Import {urls.length > 0 ? `${urls.length} URL${urls.length > 1 ? 's' : ''}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
