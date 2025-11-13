"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@libs/shadcn-ui/components/ui/card";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@libs/shadcn-ui/components/ui/dialog";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Label } from "@libs/shadcn-ui/components/ui/label";
import { Textarea } from "@libs/shadcn-ui/components/ui/textarea";

export default function BackupsSettingsPage() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  return (
    <div className="w-full px-6 pb-6 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Backups</h1>
        <Button onClick={() => setOpen(true)}>New backup</Button>
      </div>

      <Card className="max-w-2xl">
        <CardContent className="py-10">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 20h14a1 1 0 001-1v-7a1 1 0 00-1-1h-4l-2-3H5a1 1 0 00-1 1v10a1 1 0 001 1z" fill="currentColor" className="text-gray-400"/>
              </svg>
            </div>
            <div className="space-y-1">
              <div className="font-medium">No backups exist</div>
              <div className="text-sm text-gray-500">
                Publish your project or use the shortcut ⌘/Ctrl+S to create a backup.{' '}
                <Link href="#" className="underline">Learn more</Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create backup modal */}
      <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create backup</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bkp-name">Name</Label>
              <Input id="bkp-name" placeholder="Enter name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bkp-desc">Description</Label>
              <Textarea id="bkp-desc" placeholder="Enter description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                toast({ title: "Backup created", description: name || "Untitled" });
                setOpen(false);
                setName("");
                setDescription("");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
