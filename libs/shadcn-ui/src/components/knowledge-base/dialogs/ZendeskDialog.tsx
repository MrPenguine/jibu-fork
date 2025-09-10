"use client";

import React from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Input } from "../../ui/input";

interface ZendeskDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ZendeskDialog({ open, onOpenChange }: ZendeskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Integrate with platform</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Platform</Label>
            <Select defaultValue="zendesk-help-center">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zendesk-help-center">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border text-[10px]">Z</span>
                    <span>Zendesk help center</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Subdomain URL</Label>
            <Input placeholder="Enter url" />
            <p className="text-xs text-slate-500">e.g. https://company.zendesk.com</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onOpenChange(false)}>Connect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
