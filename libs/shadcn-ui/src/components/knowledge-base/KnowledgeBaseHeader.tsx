"use client";

import React from 'react';
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Plus, Eye, SlidersHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";

interface KnowledgeBaseHeaderProps {
  title?: string;
  search: string;
  onSearchChange: (v: string) => void;
  preview: boolean;
  onTogglePreview: (v: boolean) => void;
  onPickUrls: () => void;
  onPickSitemap: () => void;
  onPickUpload: () => void;
  onPickPlainText: () => void;
  onOpenSettings?: () => void;
  onPickZendesk?: () => void;
  onOpenKnowledgeApi?: () => void;
}

export function KnowledgeBaseHeader({
  title = "Knowledge base",
  search,
  onSearchChange,
  preview,
  onTogglePreview,
  onPickUrls,
  onPickSitemap,
  onPickUpload,
  onPickPlainText,
  onOpenSettings,
  onPickZendesk,
  onOpenKnowledgeApi,
}: KnowledgeBaseHeaderProps) {
  return (
    <div className="w-full px-6 pb-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search"
              className="h-9 w-56 pl-3 pr-10"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 select-none rounded border bg-slate-50 px-1.5 py-0.5 text-[10px] leading-none text-slate-500">
              ⌘ K
            </span>
          </div>
          {/* Settings buttons (UI only) */}
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Knowledge base settings" onClick={onOpenSettings}>
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          {/* Preview button */}
          <Button variant="outline" className="h-9" onClick={() => onTogglePreview(!preview)}>
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-9">
                <Plus className="h-4 w-4 mr-2" /> Add data source
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={onPickUrls}>URL(s)</DropdownMenuItem>
              <DropdownMenuItem onClick={onPickSitemap}>Sitemap</DropdownMenuItem>
              <DropdownMenuItem onClick={onPickUpload}>
                <div className="flex w-full items-center justify-between">
                  <span>Upload file</span>
                  <span className="text-xs text-slate-500">pdf, txt, docx</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPickPlainText}>Plain text</DropdownMenuItem>
              <DropdownMenuItem onClick={onPickZendesk}>
                <div className="flex w-full items-center gap-2">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border text-[10px]">Z</span>
                  <span>Zendesk</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenKnowledgeApi}>
                <div className="w-full text-xs text-slate-600">Add sources with the Knowledge API</div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
