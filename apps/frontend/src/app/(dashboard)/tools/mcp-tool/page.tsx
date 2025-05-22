'use client';

import React from 'react';
import { McpToolCard } from '@libs/shadcn-ui/src/components/tools/mcp-tool';
import { Button } from '@libs/shadcn-ui/src/components/ui/button';
import { ArrowLeft, Webhook } from 'lucide-react';
import Link from 'next/link';

export default function McpToolPage() {
  return (
    <div className="py-2">
      <div className="flex items-center mb-6">
        <Link href="/tools" className="mr-4">
          <Button variant="outline" size="icon" className="rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="h-6 w-6 text-blue-500" />
            MCP Tool
          </h1>
          <p className="text-muted-foreground">Connect to Model Context Protocol (MCP) servers for enhanced capabilities</p>
        </div>
      </div>
      <McpToolCard />
    </div>
  );
}
