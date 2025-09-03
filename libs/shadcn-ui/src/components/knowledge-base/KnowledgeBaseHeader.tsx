"use client";

import React from 'react';
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Plus, Eye } from "lucide-react";
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
              className="h-9 w-56 pl-3 pr-3"
            />
          </div>
          <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded-md border bg-white">
            <Eye className="h-4 w-4 text-slate-500" />
            <Label htmlFor="kb-preview" className="text-xs text-slate-600">Preview</Label>
            <Switch id="kb-preview" checked={preview} onCheckedChange={onTogglePreview} />
          </div>
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
              <div className="px-2 py-1.5 text-xs text-slate-500">Add sources with the Knowledge API</div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
