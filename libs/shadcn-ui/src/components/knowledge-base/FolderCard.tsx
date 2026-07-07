"use client";

import React from "react";
import { Folder, Trash2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
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

export interface FolderCardProps {
  id: string;
  name: string;
  fileCount?: number;
  processingCount?: number;
  onDelete: (id: string) => void;
  onToggleExpand?: (folderId: string, expanded: boolean) => void;
  isExpanded?: boolean;
  children?: React.ReactNode;
}

export function FolderCard({
  id,
  name,
  fileCount = 0,
  processingCount = 0,
  onDelete,
  onToggleExpand,
  isExpanded = false,
  children,
}: FolderCardProps) {
  const handleToggle = () => {
    if (onToggleExpand) {
      onToggleExpand(id, !isExpanded);
    }
  };

  const isProcessing = processingCount > 0;

  return (
    <div className="rounded-2xl border-0 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 hover:bg-slate-50/60 transition-colors">
        <div className="flex items-center gap-3 flex-1 cursor-pointer min-w-0" onClick={handleToggle}>
          {onToggleExpand && (
            <div className="flex-shrink-0 rounded-lg hover:bg-slate-100 p-1">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              )}
            </div>
          )}
          <div className="p-2 rounded-xl bg-emerald-50 flex-shrink-0">
            <Folder className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 truncate">{name}</h3>
            <p className="text-sm text-slate-500">
              {fileCount} {fileCount === 1 ? 'file' : 'files'}
              {isProcessing && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {processingCount} indexing
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl border-0 shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-slate-800">Delete folder?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500">
                  Are you sure you want to delete the folder "{name}"? This action cannot be undone.
                  Files in this folder will not be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl border-slate-200">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(id)} className="rounded-xl bg-red-600 text-white hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {isProcessing && (
        <div className="px-4 pb-3">
          <Progress value={60} className="h-1.5 rounded-full bg-slate-100" />
        </div>
      )}

      {/* Expanded content - show files in this folder */}
      {isExpanded && children && (
        <div className="border-t border-slate-100 bg-slate-50/40 p-4">
          {children}
        </div>
      )}
    </div>
  );
}
