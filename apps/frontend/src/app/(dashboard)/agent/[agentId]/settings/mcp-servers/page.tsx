"use client";

import React from "react";
import { Card, CardContent } from "@libs/shadcn-ui/components/ui/card";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@libs/shadcn-ui/components/ui/dialog";
import { Label } from "@libs/shadcn-ui/components/ui/label";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";

type HeaderPair = { id: string; key: string; value: string };

export default function McpServersSettingsPage() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [headers, setHeaders] = React.useState<HeaderPair[]>([]);

  const addHeader = () => setHeaders((h) => [...h, { id: crypto.randomUUID(), key: "", value: "" }]);
  const removeHeader = (id: string) => setHeaders((h) => h.filter((x) => x.id !== id));
  const updateHeader = (id: string, field: "key" | "value", value: string) =>
    setHeaders((h) => h.map((x) => (x.id === id ? { ...x, [field]: value } : x)));

  return (
    <div className="w-full px-6 pb-6 pt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">MCP Servers</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44"
            />
          </div>
          <Button onClick={() => setOpen(true)}>Add MCP server</Button>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardContent className="py-10">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 7h16v4H4zM4 13h16v4H4z" fill="currentColor" className="text-gray-400"/>
              </svg>
            </div>
            <div className="space-y-1">
              <div className="font-medium">No MCP servers added</div>
              <div className="text-sm text-gray-500">Add an MCP server to start using supported tools. <a href="#" className="underline">Learn more</a></div>
            </div>
            <Button onClick={() => setOpen(true)}>Add MCP server</Button>
          </div>
        </CardContent>
      </Card>

      {/* Add MCP server modal */}
      <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add MCP server</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mcp-name">Server name</Label>
              <Input id="mcp-name" placeholder="Enter server name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mcp-url">Server URL</Label>
              <Input id="mcp-url" placeholder="Enter server url" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Headers</Label>
                <Button variant="ghost" size="sm" onClick={addHeader}>+</Button>
              </div>
              <div className="space-y-2">
                {headers.length === 0 && (
                  <div className="text-xs text-muted-foreground">No headers</div>
                )}
                {headers.map((h) => (
                  <div key={h.id} className="flex items-center gap-2">
                    <Input
                      placeholder="Header"
                      value={h.key}
                      onChange={(e) => updateHeader(h.id, "key", e.target.value)}
                      className="w-48"
                    />
                    <span className="text-muted-foreground">:</span>
                    <Input
                      placeholder="Value"
                      value={h.value}
                      onChange={(e) => updateHeader(h.id, "value", e.target.value)}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeHeader(h.id)}>-</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                toast({ title: "Server added", description: name || url || "Untitled" });
                setOpen(false);
                setName("");
                setUrl("");
                setHeaders([]);
              }}
            >
              Add MCP server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
