"use client";

import React from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Button } from "../ui/button";
import { FolderPlus, Download, Trash2, FileText, Folder as FolderIcon, ChevronDown, ChevronRight, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
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

const statusMeta: Record<string, { label: string; color: string; icon: React.ReactNode; progress?: number }> = {
  PENDING: { label: "Pending", color: "bg-amber-50 text-amber-700 border-amber-100", icon: <Clock className="h-3 w-3" />, progress: 15 },
  PROCESSING: { label: "Chunking", color: "bg-indigo-50 text-indigo-700 border-indigo-100", icon: <Loader2 className="h-3 w-3 animate-spin" />, progress: 55 },
  COMPLETED: { label: "Ready", color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: <CheckCircle2 className="h-3 w-3" />, progress: 100 },
  INDEXED: { label: "Ready", color: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: <CheckCircle2 className="h-3 w-3" />, progress: 100 },
  FAILED: { label: "Failed", color: "bg-red-50 text-red-700 border-red-100", icon: <AlertCircle className="h-3 w-3" />, progress: 0 },
};

export function KnowledgeBaseList({ sources, onCreateFolder, onDelete, onDownload, isExpanded = true, onToggleExpand }: KnowledgeBaseListProps) {
  if (!sources || sources.length === 0) return null;
  const activeCount = sources.filter((s) => s.indexingStatus === 'PENDING' || s.indexingStatus === 'PROCESSING').length;
  return (
    <div className="w-full">
      <Card className="rounded-2xl border-0 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2 flex-1">
              {onToggleExpand && (
                <button onClick={onToggleExpand} className="flex-shrink-0 hover:bg-white rounded-lg p-1 transition-colors">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  )}
                </button>
              )}
              <div className="text-sm font-semibold text-slate-800">All data sources ({sources.length})</div>
              {activeCount > 0 && (
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {activeCount} processing
                </Badge>
              )}
            </div>
            {onCreateFolder && (
              <Button variant="outline" size="sm" onClick={onCreateFolder} className="h-8 rounded-lg border-slate-200">
                <FolderPlus className="h-4 w-4 mr-1.5" /> Create folder
              </Button>
            )}
          </div>
          {isExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  <th className="text-left p-3 font-semibold text-slate-700">File Name</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Type</th>
                  <th className="text-left p-3 font-semibold text-slate-700">File Size</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Folder</th>
                  <th className="text-left p-3 font-semibold text-slate-700">Status</th>
                  <th className="text-right p-3 font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => {
                  const status = statusMeta[s.indexingStatus || 'PENDING'] || statusMeta.PENDING;
                  const isProcessing = s.indexingStatus === 'PENDING' || s.indexingStatus === 'PROCESSING';
                  return (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors relative">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="font-medium text-slate-800 truncate">{s.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600">{s.type || 'N/A'}</td>
                      <td className="p-3 text-slate-600">{s.sizeBytes ? formatFileSize(s.sizeBytes) : 'N/A'}</td>
                      <td className="p-3 text-slate-600">
                        <div className="flex items-center gap-1">
                          <FolderIcon className="h-3 w-3 text-slate-400" />
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
                            <Progress value={status.progress} className="h-1.5 rounded-full bg-slate-100" />
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-end">
                          {onDownload && s.fileId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg border-slate-200"
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
                                <Button variant="outline" size="sm" className="h-8 rounded-lg border-slate-200 text-red-600 hover:text-red-700 hover:bg-red-50">
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-2xl border-0 shadow-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-slate-800">Delete source?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-slate-500">
                                    Are you sure you want to delete "{s.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-xl border-slate-200">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDelete(s.id)} className="rounded-xl bg-red-600 text-white hover:bg-red-700">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </td>
                    </tr>
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
