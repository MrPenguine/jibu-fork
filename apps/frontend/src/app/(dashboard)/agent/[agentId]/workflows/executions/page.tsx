import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { ChevronRight, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { WorkflowExecutionList } from '@jibu-ai/shadcn-ui';

export const metadata: Metadata = {
  title: 'Workflow Executions | Jibu Console',
  description: 'View and manage workflow execution history',
};

interface PageProps {
  params: {
    agentId: string;
  };
  searchParams: {
    workflowId?: string;
    status?: string;
    tab?: string;
  };
}

export default function WorkflowExecutionsPage({ params, searchParams }: PageProps) {
  const { agentId } = params;
  const { workflowId, status } = searchParams;
  const activeTab = searchParams.tab || 'all';

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workflow Executions</h1>
          <div className="flex items-center text-sm text-muted-foreground mt-1">
            <Link href={`/agent/${agentId}`} className="hover:underline">
              Agent
            </Link>
            <ChevronRight className="h-4 w-4 mx-1" />
            <Link href={`/agent/${agentId}/workflows`} className="hover:underline">
              Workflows
            </Link>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span>Executions</span>
          </div>
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 justify-between">
              <Tabs value={activeTab} className="w-full">
                <TabsList>
                  <TabsTrigger value="all" asChild>
                    <Link href={`/agent/${agentId}/workflows/executions?tab=all${workflowId ? `&workflowId=${workflowId}` : ''}`}>
                      All
                    </Link>
                  </TabsTrigger>
                  <TabsTrigger value="completed" asChild>
                    <Link href={`/agent/${agentId}/workflows/executions?tab=completed&status=completed${workflowId ? `&workflowId=${workflowId}` : ''}`}>
                      Completed
                    </Link>
                  </TabsTrigger>
                  <TabsTrigger value="running" asChild>
                    <Link href={`/agent/${agentId}/workflows/executions?tab=running&status=running${workflowId ? `&workflowId=${workflowId}` : ''}`}>
                      Running
                    </Link>
                  </TabsTrigger>
                  <TabsTrigger value="failed" asChild>
                    <Link href={`/agent/${agentId}/workflows/executions?tab=failed&status=failed${workflowId ? `&workflowId=${workflowId}` : ''}`}>
                      Failed
                    </Link>
                  </TabsTrigger>
                </TabsList>

                <div className="flex justify-end my-4">
                  <DateRangePicker
                    align="end"
                    className="w-auto"
                  />
                </div>

                <TabsContent value="all" className="mt-0">
                  <WorkflowExecutionList 
                    agentId={agentId} 
                    filters={{ 
                      workflowId, 
                      status 
                    }} 
                  />
                </TabsContent>
                <TabsContent value="completed" className="mt-0">
                  <WorkflowExecutionList 
                    agentId={agentId} 
                    filters={{ 
                      workflowId, 
                      status: 'completed' 
                    }} 
                  />
                </TabsContent>
                <TabsContent value="running" className="mt-0">
                  <WorkflowExecutionList 
                    agentId={agentId} 
                    filters={{ 
                      workflowId, 
                      status: 'running' 
                    }} 
                  />
                </TabsContent>
                <TabsContent value="failed" className="mt-0">
                  <WorkflowExecutionList 
                    agentId={agentId} 
                    filters={{ 
                      workflowId, 
                      status: 'failed' 
                    }} 
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
