"use client";

import React, { useState } from "react";
import { Folder, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
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
  onDelete: (id: string) => void;
  onAddSource?: (folderId: string) => void;
  onToggleExpand?: (folderId: string, expanded: boolean) => void;
  isExpanded?: boolean;
  children?: React.ReactNode;
}

export function FolderCard({ id, name, fileCount = 0, onDelete, onAddSource, onToggleExpand, isExpanded = false, children }: FolderCardProps) {
  const handleToggle = () => {
    if (onToggleExpand) {
      onToggleExpand(id, !isExpanded);
    }
  };

  return (
    <div className="border rounded-lg">
      <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={handleToggle}>
          {onToggleExpand && (
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          )}
          <div className="p-2 rounded-md bg-primary/10 flex-shrink-0">
            <Folder className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{name}</h3>
            <p className="text-sm text-muted-foreground">
              {fileCount} {fileCount === 1 ? 'file' : 'files'}
            </p>
          </div>
        </div>
      
      <div className="flex items-center gap-2">
        {onAddSource && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onAddSource(id)}
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Source
          </Button>
        )}
        
        <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the folder "{name}"? This action cannot be undone.
              Files in this folder will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
      </div>
      
      {/* Expanded content - show files in this folder */}
      {isExpanded && children && (
        <div className="border-t bg-muted/30 p-4">
          {children}
        </div>
      )}
    </div>
  );
}
