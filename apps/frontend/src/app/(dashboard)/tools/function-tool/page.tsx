'use client';

import React from 'react';
import { FunctionToolCard } from '@libs/shadcn-ui/src/components/tools/function-tool';
import { Button } from '@libs/shadcn-ui/src/components/ui/button';
import { ArrowLeft, Code } from 'lucide-react';
import Link from 'next/link';

export default function FunctionToolPage() {
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
            <Code className="h-6 w-6 text-purple-500" />
            Function Tool
          </h1>
          <p className="text-muted-foreground">Execute custom functions with parameters</p>
        </div>
      </div>
      <FunctionToolCard />
    </div>
  );
}
