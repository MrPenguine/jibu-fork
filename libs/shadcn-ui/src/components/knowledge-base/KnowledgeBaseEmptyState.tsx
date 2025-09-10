"use client";

import React from "react";
import { Button } from "../ui/button";
import { FolderPlus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";

interface KnowledgeBaseEmptyStateProps {
  onAddDataSource?: () => void;
  onCreateFolder?: () => void;
  onPickUrls?: () => void;
  onPickSitemap?: () => void;
  onPickUpload?: () => void;
  onPickPlainText?: () => void;
  onPickZendesk?: () => void;
  onOpenKnowledgeApi?: () => void;
}

export function KnowledgeBaseEmptyState({ onAddDataSource, onCreateFolder, onPickUrls, onPickSitemap, onPickUpload, onPickPlainText, onPickZendesk, onOpenKnowledgeApi }: KnowledgeBaseEmptyStateProps) {
  return (
    <div className="w-full">
      <div className="border rounded-xl bg-white shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="text-sm text-slate-700 font-medium">All data sources (0)</div>
          {onCreateFolder && (
            <Button variant="outline" size="sm" onClick={onCreateFolder} className="h-8">
              <FolderPlus className="h-4 w-4 mr-1.5" /> Create folder
            </Button>
          )}
        </div>
        <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
          {/* Simple placeholder illustration */}
          <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 3l8 4v6c0 4-3 7-8 8-5-1-8-4-8-8V7l8-4z" />
              <path d="M8 10l4 2 4-2" />
            </svg>
          </div>
          <div className="text-slate-900 font-medium mb-1">No data sources exist</div>
          <p className="text-slate-500 text-sm mb-4 max-w-md">
            Add data sources to your agent to build a knowledge base of trusted content it can use.
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                Add data source
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-64">
              <DropdownMenuItem onClick={onPickUrls || onAddDataSource}>URL(s)</DropdownMenuItem>
              <DropdownMenuItem onClick={onPickSitemap || onAddDataSource}>Sitemap</DropdownMenuItem>
              <DropdownMenuItem onClick={onPickUpload || onAddDataSource}>
                <div className="flex w-full items-center justify-between">
                  <span>Upload file</span>
                  <span className="text-xs text-slate-500">pdf, txt, docx</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPickPlainText || onAddDataSource}>Plain text</DropdownMenuItem>
              <DropdownMenuItem onClick={onPickZendesk || onAddDataSource}>
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
