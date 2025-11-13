"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Label } from "@libs/shadcn-ui/components/ui/label";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";

export default function ApiSettingsPage() {
  const [primaryKey, setPrimaryKey] = React.useState("sk_live_********************************");
  const [masked, setMasked] = React.useState(true);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(primaryKey);
      toast({ title: "Copied", description: "Primary key copied to clipboard." });
    } catch {}
  };

  return (
    <div className="w-full px-6 pb-6 pt-6">
      <h1 className="text-2xl font-semibold mb-4">API keys</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main card */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Primary key</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  value={masked ? "•".repeat(32) : primaryKey}
                  onChange={(e) => setPrimaryKey(e.target.value)}
                  type="text"
                  aria-label="Primary key"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
                  onClick={() => setMasked((m) => !m)}
                >
                  {masked ? "Show" : "Hide"}
                </button>
              </div>
              <Button variant="secondary" onClick={copy}>Copy</Button>
            </div>
          </CardContent>
        </Card>

        {/* Side panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Popular APIs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="text-sm text-blue-700 space-y-1">
              <li><a href="#" className="hover:underline">Dialog messages API</a></li>
              <li><a href="#" className="hover:underline">Knowledge base API</a></li>
              <li><a href="#" className="hover:underline">Transcripts API</a></li>
              <li><a href="#" className="hover:underline">Evaluations API</a></li>
              <li><a href="#" className="hover:underline">Analytics API</a></li>
              <li><a href="#" className="hover:underline">Project API</a></li>
            </ul>
            <div className="pt-2">
              <Button variant="outline" className="w-full">Documentation</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
