"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@libs/shadcn-ui/components/ui/card';
import { Badge } from '@libs/shadcn-ui/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@libs/shadcn-ui/components/ui/dialog';
import { Input } from '@libs/shadcn-ui/components/ui/input';
import { Label } from '@libs/shadcn-ui/components/ui/label';
import { PlusCircle, Edit, Play } from 'lucide-react';
import { workflowApi, Workflow } from '../../../utils/workflowApi'; // Assuming Workflow type is exported

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const fetchedWorkflows = await workflowApi.getWorkflows();
        setWorkflows(fetchedWorkflows);
      } catch (error) {
        console.error("Failed to fetch workflows:", error);
        setWorkflows([]); // Set to empty array on error
      }
      setIsLoading(false);
    };
    fetchWorkflows();
  }, []);

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      // Basic validation, consider more robust validation
      alert("Workflow name cannot be empty.");
      return;
    }
    try {
      const newWorkflow = await workflowApi.createWorkflow({
        name: newWorkflowName,
        description: newWorkflowDescription,
        nodes: [], // Added empty nodes array
        edges: [], // Added empty edges array
        assistantId: "mock_assistant_id_replace_me", // Added placeholder assistantId
        // TODO: Determine how assistantId is sourced or if it's needed here. 
        // This might come from user context, a selection, or a default value.
      });
      setWorkflows(prev => [...prev, newWorkflow]);
      setIsCreateModalOpen(false);
      setNewWorkflowName('');
      setNewWorkflowDescription('');
      router.push(`/workflows/${newWorkflow.id}`);
    } catch (error) {
      console.error("Failed to create workflow:", error);
      alert("Failed to create workflow. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex justify-center items-center">
        <p>Loading workflows...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">
            Create and manage automated conversation flows
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Workflow</DialogTitle>
              <DialogDescription>
                Enter the details for your new workflow. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  className="col-span-3"
                  placeholder="My Awesome Workflow"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Input
                  id="description"
                  value={newWorkflowDescription}
                  onChange={(e) => setNewWorkflowDescription(e.target.value)}
                  className="col-span-3"
                  placeholder="Optional: Describe what this workflow does"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateWorkflow}>Save Workflow</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!isLoading && workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-3">
              <h3 className="text-lg font-medium">No workflows found</h3>
              <p className="text-sm text-muted-foreground">
                Get started by creating your first workflow
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Workflow
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="truncate">{workflow.name}</CardTitle>
                  <Badge variant={workflow.isPublished ? 'default' : 'outline'}>
                    {workflow.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                <CardDescription className="truncate">{workflow.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <div>
                    <span className="text-muted-foreground">Version:</span> {workflow.version}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last updated:</span>{' '}
                    {new Date(workflow.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/workflows/${workflow.id}`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit / View
                  </Link>
                </Button>
                {/* The 'Run' button might be part of the [id] page or handled differently now */}
                {/* For now, let's assume the [id] page will handle running as well */}
                 <Button variant="outline" size="sm" asChild disabled={!workflow.isPublished}>
                  <Link href={`/workflows/${workflow.id}?action=run`}> 
                    {/* Or simply link to /workflows/${workflow.id} and handle run via a tab/button there */}
                    <Play className="mr-2 h-4 w-4" />
                    Run
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
