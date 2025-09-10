"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

interface KnowledgeBasePreviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function KnowledgeBasePreviewDialog({ open, onOpenChange }: KnowledgeBasePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Knowledge base preview</DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Question</label>
          <Input placeholder="Enter question..." />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onOpenChange(false)}>Send</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
