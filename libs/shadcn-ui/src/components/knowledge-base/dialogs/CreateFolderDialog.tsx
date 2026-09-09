"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { FolderPlus } from "lucide-react";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (name: string) => void;
}

export function CreateFolderDialog({ open, onOpenChange, onCreate }: CreateFolderDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) setName("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] rounded-lg  bg-card p-0 shadow-2xl overflow-hidden">
        <DialogHeader className="bg-gradient-to-r from-primary to-green-600 px-6 py-5 text-white">
          <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Create folder
          </DialogTitle>
          <DialogDescription className="text-green-50">
            Create a folder to organize your knowledge base sources.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-5">
          <div className="grid gap-2">
            <Label htmlFor="kb-folder-name" className="text-gray-700 font-medium">Name</Label>
            <Input
              id="kb-folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border-border focus-visible:ring-primary"
              placeholder="Enter folder name"
            />
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-background/50">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-md border-border">Cancel</Button>
          <Button
            onClick={() => onCreate(name)}
            disabled={!name.trim()}
            className="rounded-md bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <FolderPlus className="h-4 w-4" />
            Create folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
