"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog";
import { ScrollArea } from "../../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Button } from "../../ui/button";

interface KnowledgeApiDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function KnowledgeApiDialog({ open, onOpenChange }: KnowledgeApiDialogProps) {
  const curl = `curl -X POST https://api.example.com/knowledge-base/query \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "What is the refund policy?",
    "filters": { "product": "console" },
    "top_k": 5
  }'`;

  const node = `import fetch from 'node-fetch';

const res = await fetch('https://api.example.com/knowledge-base/query', {
  method: 'POST',
  headers: {
    'Authorization': ` + "`Bearer ${process.env.TOKEN}`" + `,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: 'What is the refund policy?', filters: { product: 'console' }, top_k: 5 })
});
const data = await res.json();
console.log(data);`;

  const python = `import os, requests

resp = requests.post(
  'https://api.example.com/knowledge-base/query',
  headers={
    'Authorization': f'Bearer {os.environ["TOKEN"]}',
    'Content-Type': 'application/json'
  },
  json={ 'query': 'What is the refund policy?', 'filters': { 'product': 'console' }, 'top_k': 5 }
)
print(resp.json())`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0">
        <DialogHeader className="px-6 pt-4">
          <div className="flex items-center justify-between">
            <DialogTitle>Knowledge API</DialogTitle>
            <Button variant="outline" onClick={() => window.open('https://docs.example.com/knowledge-api', '_blank')}>Open full docs</Button>
          </div>
        </DialogHeader>
        <div className="h-[65vh]">
          <ScrollArea className="h-full px-6 pb-6">
            <div className="prose prose-slate max-w-none dark:prose-invert">
              <h2>Overview</h2>
              <p>
                The Knowledge Base APIs provide tools for uploading documents, querying content with filters, and managing your knowledge base programmatically.
              </p>
              <h3>Query API</h3>
              <p>Send a query and receive the most relevant chunks.</p>
            </div>
            <div className="mt-4 rounded-md border">
              <Tabs defaultValue="curl">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <TabsList>
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                    <TabsTrigger value="node">Node</TabsTrigger>
                    <TabsTrigger value="python">Python</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="curl" className="p-3">
                  <pre className="overflow-auto rounded bg-slate-950 p-3 text-slate-100 text-xs"><code>{curl}</code></pre>
                  <div className="mt-2 flex justify-end"><Button size="sm" onClick={() => copy(curl)}>Copy</Button></div>
                </TabsContent>
                <TabsContent value="node" className="p-3">
                  <pre className="overflow-auto rounded bg-slate-950 p-3 text-slate-100 text-xs"><code>{node}</code></pre>
                  <div className="mt-2 flex justify-end"><Button size="sm" onClick={() => copy(node)}>Copy</Button></div>
                </TabsContent>
                <TabsContent value="python" className="p-3">
                  <pre className="overflow-auto rounded bg-slate-950 p-3 text-slate-100 text-xs"><code>{python}</code></pre>
                  <div className="mt-2 flex justify-end"><Button size="sm" onClick={() => copy(python)}>Copy</Button></div>
                </TabsContent>
              </Tabs>
            </div>
            <div className="prose prose-slate max-w-none dark:prose-invert mt-6">
              <h3>Document API</h3>
              <p>Upload, list, update, and delete documents in your KB.</p>
              <h3>Authentication</h3>
              <p>Use Bearer tokens with project or agent credentials.</p>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
