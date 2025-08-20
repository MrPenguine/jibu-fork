import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, RefreshCw, Clock, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  WorkflowExecutionDetail, 
  WorkflowExecutionTimeline, 
  WorkflowExecutionLogs 
} from '@jibu-ai/shadcn-ui';

export const metadata: Metadata = {
  title: 'Workflow Execution Details | Jibu Console',
  description: 'View detailed information about a workflow execution',
};

interface PageProps {
  params: {
    agentId: string;
    executionId: string;
  };
  searchParams: {
    tab?: string;
  };
}

export default function WorkflowExecutionDetailPage({ params, searchParams }: PageProps) {
  const { agentId, executionId } = params;
  const activeTab = searchParams.tab || 'overview';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="mr-2">
              <Link href={`/agent/${agentId}/workflows/executions`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Execution Details</h1>
          </div>
          <div className="flex items-center text-sm text-muted-foreground mt-1">
            <Link href={`/agent/${agentId}`} className="hover:underline">
              Agent
            </Link>
            <ChevronRight className="h-4 w-4 mx-1" />
            <Link href={`/agent/${agentId}/workflows`} className="hover:underline">
              Workflows
            </Link>
            <ChevronRight className="h-4 w-4 mx-1" />
            <Link href={`/agent/${agentId}/workflows/executions`} className="hover:underline">
              Executions
            </Link>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span>{executionId.substring(0, 8)}...</span>
          </div>
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <WorkflowExecutionDetail 
        agentId={agentId} 
        executionId={executionId} 
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Execution Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} className="w-full">
            <TabsList>
              <TabsTrigger value="overview" asChild>
                <Link href={`/agent/${agentId}/workflows/executions/${executionId}?tab=overview`}>
                  Overview
                </Link>
              </TabsTrigger>
              <TabsTrigger value="timeline" asChild>
                <Link href={`/agent/${agentId}/workflows/executions/${executionId}?tab=timeline`}>
                  Timeline
                </Link>
              </TabsTrigger>
              <TabsTrigger value="logs" asChild>
                <Link href={`/agent/${agentId}/workflows/executions/${executionId}?tab=logs`}>
                  Logs
                </Link>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <WorkflowExecutionDetail 
                agentId={agentId} 
                executionId={executionId} 
                detailed
              />
            </TabsContent>
            <TabsContent value="timeline" className="mt-4">
              <WorkflowExecutionTimeline 
                agentId={agentId} 
                executionId={executionId} 
              />
            </TabsContent>
            <TabsContent value="logs" className="mt-4">
              <WorkflowExecutionLogs 
                agentId={agentId} 
                executionId={executionId} 
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
