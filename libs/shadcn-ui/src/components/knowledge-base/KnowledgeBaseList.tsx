"use client";

import React from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { FolderPlus, Download, Trash2, FileText, Folder as FolderIcon, ChevronDown, ChevronRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";

export interface KnowledgeBaseSource {
  id: string;
  name: string;
  type: string;
  createdAt?: string;
  folder?: { id: string; name: string } | null;
  fileId?: string;
  mimeType?: string;
  sizeBytes?: number;
}

interface KnowledgeBaseListProps {
  sources: KnowledgeBaseSource[];
  onCreateFolder?: () => void;
  onDelete?: (sourceId: string) => void;
  onDownload?: (fileId: string, fileName: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export function KnowledgeBaseList({ sources, onCreateFolder, onDelete, onDownload, isExpanded = true, onToggleExpand }: KnowledgeBaseListProps) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="w-full">
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {onToggleExpand && (
                <button onClick={onToggleExpand} className="flex-shrink-0 hover:bg-accent rounded p-1">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )}
              <div className="text-sm text-slate-700 font-medium">All data sources ({sources.length})</div>
            </div>
            {onCreateFolder && (
              <Button variant="outline" size="sm" onClick={onCreateFolder} className="h-8">
                <FolderPlus className="h-4 w-4 mr-1.5" /> Create folder
              </Button>
            )}
          </div>
          {isExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-semibold">File Name</th>
                  <th className="text-left p-3 font-semibold">Type</th>
                  <th className="text-left p-3 font-semibold">File Size</th>
                  <th className="text-left p-3 font-semibold">Folder</th>
                  <th className="text-left p-3 font-semibold">Date Uploaded</th>
                  <th className="text-right p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <span className="font-medium truncate">{s.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-600">{s.type || 'N/A'}</td>
                    <td className="p-3 text-slate-600">{s.sizeBytes ? formatFileSize(s.sizeBytes) : 'N/A'}</td>
                    <td className="p-3 text-slate-600">
                      <div className="flex items-center gap-1">
                        <FolderIcon className="h-3 w-3" />
                        <span>{s.folder ? s.folder.name : 'N/A'}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-600">
                      {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-end">
                        {onDownload && s.fileId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => onDownload(s.fileId!, s.name)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        )}
                        {onDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete source?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{s.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
