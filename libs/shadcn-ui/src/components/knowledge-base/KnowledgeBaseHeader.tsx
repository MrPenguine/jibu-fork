"use client";

import React from 'react';
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Plus, Eye, SlidersHorizontal, Boxes, Loader2, Sparkles } from "lucide-react";

interface KnowledgeBaseHeaderProps {
  title?: string;
  search: string;
  onSearchChange: (v: string) => void;
  preview: boolean;
  onTogglePreview: (v: boolean) => void;
  onOpenSettings?: () => void;
  onOpenChunks?: () => void;
  onOpenAddDataSource?: () => void;
  processingCount?: number;
}

export function KnowledgeBaseHeader({
  title = "Knowledge base",
  search,
  onSearchChange,
  preview,
  onTogglePreview,
  onOpenSettings,
  onOpenChunks,
  onOpenAddDataSource,
  processingCount = 0,
}: KnowledgeBaseHeaderProps) {
  const isProcessing = processingCount > 0;
  return (
    <div className="w-full px-6 pb-4 pt-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-primary to-emerald-600 p-2.5 shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            {isProcessing && (
              <div className="flex items-center gap-1.5 text-xs text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{processingCount} source{processingCount === 1 ? "" : "s"} indexing…</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search"
              className="h-9 w-56 pl-3 pr-10 rounded-xl border-slate-200"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 select-none rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] leading-none text-slate-500">
              ⌘ K
            </span>
          </div>
          {/* Settings buttons (UI only) */}
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-slate-200" aria-label="Knowledge base settings" onClick={onOpenSettings}>
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          {/* Browse chunks */}
          {onOpenChunks && (
            <Button variant="outline" className="h-9 rounded-xl border-slate-200" onClick={onOpenChunks}>
              <Boxes className="h-4 w-4 mr-2" /> Chunks
            </Button>
          )}
          {/* Preview / retrieval test button */}
          <Button
            variant="outline"
            className="h-9 rounded-xl border-slate-200"
            onClick={() => onTogglePreview(!preview)}
            disabled={isProcessing}
            title={isProcessing ? "Wait for indexing to finish before testing" : "Test retrieval"}
          >
            <Eye className="h-4 w-4 mr-2" />
            {isProcessing ? "Indexing…" : "Test"}
          </Button>
          <Button
            onClick={onOpenAddDataSource}
            className="h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add data source
          </Button>
        </div>
      </div>
    </div>
  );
}
