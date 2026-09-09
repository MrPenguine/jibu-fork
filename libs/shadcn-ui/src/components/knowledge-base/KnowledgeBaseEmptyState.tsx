"use client";

import React from "react";
import { Button } from "../ui/button";
import { FolderPlus, Plus, Database } from "lucide-react";

interface KnowledgeBaseEmptyStateProps {
  onAddDataSource?: () => void;
  onCreateFolder?: () => void;
}

export function KnowledgeBaseEmptyState({ onAddDataSource, onCreateFolder }: KnowledgeBaseEmptyStateProps) {
  return (
    <div className="w-full">
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-background/50">
          <div className="text-sm font-semibold text-foreground">All data sources (0)</div>
          {onCreateFolder && (
            <Button variant="ghost" size="icon" onClick={onCreateFolder} className="h-8 w-8 rounded-lg" aria-label="Create folder">
              <FolderPlus className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
        <div className="py-16 px-6 flex flex-col items-center justify-center text-center">
          <div className="h-20 w-20 rounded-full bg-green-50 flex items-center justify-center mb-4">
            <Database className="h-10 w-10 text-primary" />
          </div>
          <div className="text-foreground font-semibold mb-1 text-lg">No data sources yet</div>
          <p className="text-muted-foreground text-sm mb-6 max-w-md">
            Add files, URLs, or paste text to build a knowledge base your agent can answer from.
          </p>
          <Button
            onClick={onAddDataSource}
            className="rounded-md bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add data source
          </Button>
        </div>
      </div>
    </div>
  );
}
