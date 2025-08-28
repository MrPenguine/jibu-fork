"use client";

import React from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { FolderPlus } from "lucide-react";

export interface KnowledgeBaseSource {
  id: string;
  name: string;
  type: string;
  createdAt?: string;
}

interface KnowledgeBaseListProps {
  sources: KnowledgeBaseSource[];
  onCreateFolder?: () => void;
}

export function KnowledgeBaseList({ sources, onCreateFolder }: KnowledgeBaseListProps) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="w-full">
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="text-sm text-slate-700 font-medium">All data sources ({sources.length})</div>
            {onCreateFolder && (
              <Button variant="outline" size="sm" onClick={onCreateFolder} className="h-8">
                <FolderPlus className="h-4 w-4 mr-1.5" /> Create folder
              </Button>
            )}
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.map((s) => (
              <div key={s.id} className="border rounded-lg p-4 bg-white">
                <div className="font-medium text-slate-900 truncate">{s.name}</div>
                <div className="text-xs text-slate-500 mt-1">{s.type}</div>
                {s.createdAt && (
                  <div className="text-xs text-slate-400 mt-2">{new Date(s.createdAt).toLocaleDateString()}</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
