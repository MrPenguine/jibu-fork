"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";

export interface SitemapImportPayload {
  sitemapUrl: string;
  refreshRate: string;
  chunkingStrategy?: string;
  folderId?: string;
}

interface SitemapImportDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (payload: SitemapImportPayload) => void;
}

export function SitemapImportDialog({ open, onOpenChange, onImport }: SitemapImportDialogProps) {
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [refreshRate, setRefreshRate] = useState("never");
  const [chunkingStrategy, setChunkingStrategy] = useState<string | undefined>();
  const [folderId, setFolderId] = useState<string | undefined>();

  useEffect(() => {
    if (!open) {
      setSitemapUrl("");
      setRefreshRate("never");
      setChunkingStrategy(undefined);
      setFolderId(undefined);
    }
  }, [open]);

  const handleImport = () => {
    onImport({
      sitemapUrl: sitemapUrl.trim(),
      refreshRate,
      chunkingStrategy,
      folderId,
    });
  };

  const isValid = !!sitemapUrl.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Import from sitemap</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-2">
          {/* Sitemap URL Input */}
          <div className="grid gap-2">
            <Label htmlFor="kb-sitemap-url">Sitemap URL</Label>
            <Input
              id="kb-sitemap-url"
              value={sitemapUrl}
              onChange={(e) => setSitemapUrl(e.target.value)}
              placeholder="Enter sitemap URL"
            />
            <p className="text-sm text-slate-500">e.g. https://www.domain.com/sitemap.xml</p>
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
          <Button onClick={handleImport} disabled={!isValid}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
