"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@libs/shadcn-ui/components/ui/card';
import { Skeleton } from '@libs/shadcn-ui/components/ui/skeleton';
import { Plus, Edit, Play, Trash2 } from 'lucide-react';
import { fetchAPI } from '../../../../../utils/api';

interface Workflow {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export default function AgentWorkflowsPage({ params }: { params: { agentId: string } }) {
  const [isLoading, setIsLoading] = useState(true);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchWorkflows = async () => {
      if (!params.agentId) {
        router.push('/workspace');
        return;
      }

      try {
        setIsLoading(true);
        // Fetch workflows for this agent
        const fetchedWorkflows = await fetchAPI(`/v1/agents/${params.agentId}/workflows`);
        setWorkflows(fetchedWorkflows || []);
      } catch (error) {
        console.error("Failed to fetch workflows:", error);
        // Set sample data for demonstration
        setWorkflows([
          {
            id: 'workflow-1',
            name: 'Customer Onboarding',
            description: 'Guide new customers through the onboarding process',
            createdAt: '2023-08-15T10:30:00Z',
            updatedAt: '2023-09-01T15:45:00Z'
          },
          {
            id: 'workflow-2',
            name: 'Support Ticket Triage',
            description: 'Automatically categorize and route support tickets',
            createdAt: '2023-07-20T08:15:00Z',
            updatedAt: '2023-08-25T11:20:00Z'
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, [params.agentId, router]);

  const handleCreateWorkflow = () => {
    router.push(`/agent/${params.agentId}/workflows/create`);
  };

  const handleEditWorkflow = (workflowId: string) => {
    router.push(`/agent/${params.agentId}/workflows/${workflowId}/edit`);
  };

  const handleRunWorkflow = (workflowId: string) => {
    router.push(`/agent/${params.agentId}/workflows/${workflowId}/run`);
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (window.confirm("Are you sure you want to delete this workflow?")) {
      try {
        await fetchAPI(`/v1/agents/${params.agentId}/workflows/${workflowId}`, {
          method: 'DELETE'
        });
        setWorkflows(workflows.filter(wf => wf.id !== workflowId));
      } catch (error) {
        console.error("Failed to delete workflow:", error);
        alert("Failed to delete workflow. Please try again.");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="w-full px-6 pb-6 pt-0">
        <Skeleton className="h-10 w-1/3" />
        <div className="mt-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 pb-6 pt-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Workflows</h1>
        <Button onClick={handleCreateWorkflow}>
          <Plus className="mr-2 h-4 w-4" /> Create Workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <p className="text-muted-foreground mb-4">No workflows found</p>
            <Button onClick={handleCreateWorkflow}>
              <Plus className="mr-2 h-4 w-4" /> Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader>
                <CardTitle>{workflow.name}</CardTitle>
                <CardDescription>{workflow.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground mb-4">
                  Last updated: {new Date(workflow.updatedAt).toLocaleDateString()}
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleEditWorkflow(workflow.id)}
                  >
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleRunWorkflow(workflow.id)}
                  >
                    <Play className="h-4 w-4 mr-1" /> Run
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDeleteWorkflow(workflow.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
