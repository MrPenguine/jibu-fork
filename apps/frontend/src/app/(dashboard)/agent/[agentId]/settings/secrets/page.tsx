"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@libs/shadcn-ui/components/ui/card";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@libs/shadcn-ui/components/ui/dialog";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Label } from "@libs/shadcn-ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@libs/shadcn-ui/components/ui/select";

export default function SecretsSettingsPage() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [value, setValue] = React.useState("");
  const [visibility, setVisibility] = React.useState<"masked" | "restricted">("masked");
  const [showValue, setShowValue] = React.useState(false);
  return (
    <div className="w-full px-6 pb-6 pt-6">
      <h1 className="text-2xl font-semibold mb-4">Secrets</h1>

      <Card className="max-w-2xl">
        <CardContent className="py-10">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 3a5 5 0 00-5 5v2H6a2 2 0 00-2 2v6a2 2 0 002 2h12a2 2 0 002-2v-6a2 2 0 00-2-2h-1V8a5 5 0 00-5-5zM9 10V8a3 3 0 016 0v2H9z" fill="currentColor" className="text-gray-400"/>
              </svg>
            </div>
            <div className="space-y-1">
              <div className="font-medium">No secrets exist</div>
              <div className="text-sm text-gray-500">
                Add your secrets so your team can start using them.{' '}
                <Link href="#" className="underline">Learn more</Link>
              </div>
            </div>
            <Button onClick={() => setOpen(true)}>
              Create secret
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create secret modal */}
      <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create secret</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sec-name">Name</Label>
              <Input id="sec-name" placeholder="Enter name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-value">Value</Label>
              <div className="relative">
                <Input
                  id="sec-value"
                  placeholder="Enter value"
                  type={showValue ? "text" : "password"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
                  onClick={() => setShowValue((s) => !s)}
                >
                  {showValue ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="masked">
                    <div className="flex items-center justify-between w-full">
                      <span>Masked</span>
                      <span className="text-xs text-muted-foreground">Visible on click</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="restricted">
                    <div className="flex items-center justify-between w-full">
                      <span>Restricted</span>
                      <span className="text-xs text-muted-foreground">Never visible</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                toast({ title: "Secret created", description: `${name || "(no name)"} • ${visibility}` });
                setOpen(false);
                setName("");
                setValue("");
                setVisibility("masked");
                setShowValue(false);
              }}
            >
              Create secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
