"use client";

import React from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Button } from "../ui/button";
import { FolderPlus, Download, Trash2, FileText, Folder as FolderIcon, ChevronDown, ChevronRight, Loader2, CheckCircle2, AlertCircle, Clock, RotateCcw } from "lucide-react";
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
  indexingStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'INDEXED' | 'FAILED' | string;
  progress?: number | null;
  lastError?: string | null;
  chunkCount?: number | null;
}

interface KnowledgeBaseListProps {
  sources: KnowledgeBaseSource[];
  onCreateFolder?: () => void;
  onDelete?: (sourceId: string) => void;
  onDownload?: (fileId: string, fileName: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  eventsBySource?: Record<string, Array<{ id: string; stage: string; message: string; createdAt: string; progress: number | null }>>;
  latestBySource?: Record<string, { stage: string; message: string; progress: number | null }>;
  onRetry?: (sourceId: string) => void;
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const statusMeta: Record<string, { label: string; color: string; icon: React.ReactNode; progress?: number }> = {
  PENDING: { label: "Pending", color: "bg-background text-gray-700 border-border", icon: <Clock className="h-3 w-3" />, progress: 0 },
  PROCESSING: { label: "Processing", color: "bg-amber-50 text-amber-700 border-amber-100", icon: <Loader2 className="h-3 w-3 animate-spin" />, progress: 55 },
  COMPLETED: { label: "Ready", color: "bg-green-50 text-green-700 border-green-100", icon: <CheckCircle2 className="h-3 w-3" />, progress: 100 },
  INDEXED: { label: "Ready", color: "bg-green-50 text-green-700 border-green-100", icon: <CheckCircle2 className="h-3 w-3" />, progress: 100 },
  FAILED: { label: "Failed", color: "bg-red-50 text-destructive border-red-100", icon: <AlertCircle className="h-3 w-3" />, progress: 0 },
};

export function KnowledgeBaseList({ sources, onCreateFolder, onDelete, onDownload, isExpanded = true, onToggleExpand, eventsBySource, latestBySource, onRetry }: KnowledgeBaseListProps) {
  if (!sources || sources.length === 0) return null;
  const activeCount = sources.filter((s) => s.indexingStatus === 'PENDING' || s.indexingStatus === 'PROCESSING').length;
  return (
    <div className="w-full">
      <Card className="rounded-lg border border-border shadow-sm bg-card overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-background/50">
            <div className="flex items-center gap-2 flex-1">
              {onToggleExpand && (
                <button onClick={onToggleExpand} className="flex-shrink-0 hover:bg-background rounded-lg p-1 transition-colors">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )}
              <div className="text-sm font-semibold text-foreground">All data sources ({sources.length})</div>
              {activeCount > 0 && (
                <Badge variant="outline" className="bg-accent text-primary border-green-200 gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {activeCount} processing
                </Badge>
              )}
            </div>
            {onCreateFolder && (
              <Button variant="outline" size="sm" onClick={onCreateFolder} className="h-8 rounded-lg border-border">
                <FolderPlus className="h-4 w-4 mr-1.5" /> Create folder
              </Button>
            )}
          </div>
          {isExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-background/40">
                  <th className="text-left p-3 font-semibold text-gray-700">File Name</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Type</th>
                  <th className="text-left p-3 font-semibold text-gray-700">File Size</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Folder</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                  <th className="text-right p-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => {
                  const latest = latestBySource?.[s.id];
                  const effectiveStatus = latest?.stage === 'COMPLETED' ? 'COMPLETED'
                    : latest?.stage === 'FAILED' ? 'FAILED'
                    : latest?.stage === 'QUEUED' ? 'PENDING'
                    : latest?.stage && latest.stage !== 'DEINDEXED' ? 'PROCESSING'
                    : s.indexingStatus || 'PENDING';
                  const status = statusMeta[effectiveStatus] || statusMeta.PENDING;
                  const isProcessing = effectiveStatus === 'PENDING' || effectiveStatus === 'PROCESSING';
                  const progress = latest?.progress ?? s.progress ?? status.progress;
                  const timeline = eventsBySource?.[s.id] || [];
                  return (
                    <React.Fragment key={s.id}>
                    <tr className="border-b border-gray-100 hover:bg-background/60 transition-colors relative">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="font-medium text-foreground truncate">{s.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{s.type || 'N/A'}</td>
                      <td className="p-3 text-muted-foreground">{s.sizeBytes ? formatFileSize(s.sizeBytes) : 'N/A'}</td>
                      <td className="p-3 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <FolderIcon className="h-3 w-3 text-gray-400" />
                          <span>{s.folder ? s.folder.name : 'N/A'}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1.5 min-w-[120px]">
                          <Badge variant="outline" className={`gap-1 font-normal ${status.color}`}>
                            {status.icon}
                            {status.label}
                          </Badge>
                          {isProcessing && (
                            <Progress value={progress} className="h-1.5 rounded-full bg-muted" />
                          )}
                          {latest && <span className="text-[11px] text-muted-foreground">{latest.message}</span>}
                          {effectiveStatus === 'FAILED' && s.lastError && <span className="text-[11px] text-destructive">{s.lastError}</span>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-end">
                          {onDownload && s.fileId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg border-border"
                              onClick={() => onDownload(s.fileId!, s.name)}
                              disabled={isProcessing}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          )}
                          {onDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 rounded-lg border-border text-destructive hover:text-destructive hover:bg-red-50">
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-lg border-0 shadow-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-foreground">Delete source?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-muted-foreground">
                                    Are you sure you want to delete "{s.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-lg border-border">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDelete(s.id)} className="rounded-lg bg-destructive text-white hover:bg-red-700">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {effectiveStatus === 'FAILED' && onRetry && (
                            <Button variant="outline" size="sm" className="h-8 rounded-lg border-border" onClick={() => onRetry(s.id)}>
                              <RotateCcw className="h-3 w-3 mr-1" /> Retry
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {timeline.length > 0 && (
                      <tr className="border-b border-gray-100">
                        <td colSpan={6} className="px-6 py-2">
                          <details>
                            <summary className="cursor-pointer text-xs text-muted-foreground">View indexing timeline ({timeline.length})</summary>
                            <div className="mt-2 space-y-1 border-l-2 border-gray-100 pl-3">
                              {timeline.map((event) => (
                                <div key={event.id} className="text-xs text-muted-foreground">
                                  <span className="font-medium">{event.stage}</span> · {new Date(event.createdAt).toLocaleString()} — {event.message}
                                </div>
                              ))}
                            </div>
                          </details>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
