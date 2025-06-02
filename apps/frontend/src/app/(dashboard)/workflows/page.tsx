"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@libs/shadcn-ui/components/ui/card';
import { Badge } from '@libs/shadcn-ui/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@libs/shadcn-ui/components/ui/dialog';
import { Input } from '@libs/shadcn-ui/components/ui/input';
import { Textarea } from '@libs/shadcn-ui/components/ui/textarea';
import { Label } from '@libs/shadcn-ui/components/ui/label';
import { PlusCircle, Edit, Play, Trash2, Pencil } from 'lucide-react';
import { workflowApi } from '../../../utils/workflowApi';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<any | null>(null);
  const [editWorkflowName, setEditWorkflowName] = useState('');
  const [editWorkflowDescription, setEditWorkflowDescription] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const fetchedWorkflows = await workflowApi.getWorkflows();
        setWorkflows(fetchedWorkflows as any[]);
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
      alert("Workflow name cannot be empty.");
      return;
    }
    
    try {
      const newWorkflow = await workflowApi.createWorkflow({
        name: newWorkflowName,
        description: newWorkflowDescription,
        nodes: [], // Empty nodes array to start with
        edges: [], // Empty edges array to start with
      });
      
      setWorkflows(prev => [...prev, newWorkflow as any]);
      setIsCreateModalOpen(false);
      setNewWorkflowName('');
      setNewWorkflowDescription('');
      router.push(`/workflows/${newWorkflow.id}`);
    } catch (error) {
      console.error("Failed to create workflow:", error);
      alert("Failed to create workflow. Please try again.");
    }
  };

  const handleOpenEditModal = (workflow: any) => {
    setEditingWorkflow(workflow);
    setEditWorkflowName(workflow.name);
    setEditWorkflowDescription(workflow.description || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateWorkflow = async () => {
    if (!editingWorkflow || !editWorkflowName.trim()) {
      alert("Workflow name cannot be empty.");
      return;
    }
    try {
      const updatedWorkflowData = {
        ...editingWorkflow,
        name: editWorkflowName,
        description: editWorkflowDescription,
      };
      // Remove fields that should not be sent on update, or ensure API handles them
      delete updatedWorkflowData.createdAt; 
      delete updatedWorkflowData.updatedAt;
      delete updatedWorkflowData.id; // ID is in the URL path

      const updated = await workflowApi.updateWorkflow(editingWorkflow.id, updatedWorkflowData);
      setWorkflows(workflows.map(wf => wf.id === editingWorkflow.id ? { ...wf, ...updated } : wf));
      setIsEditModalOpen(false);
      setEditingWorkflow(null);
    } catch (error) {
      console.error("Failed to update workflow:", error);
      alert("Failed to update workflow. Please try again.");
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (window.confirm("Are you sure you want to delete this workflow? This action cannot be undone.")) {
      try {
        await workflowApi.deleteWorkflow(workflowId);
        setWorkflows(workflows.filter(wf => wf.id !== workflowId));
      } catch (error) {
        console.error("Failed to delete workflow:", error);
        alert("Failed to delete workflow. Please try again.");
      }
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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/workflows/${workflow.id}`}>
                      <Edit className="mr-2 h-4 w-4" /> View/Design
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(workflow)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteWorkflow(workflow.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Workflow Modal */}
      {editingWorkflow && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Workflow</DialogTitle>
              <DialogDescription>
                Update the name and description for your workflow. Click save when done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="edit-name"
                  value={editWorkflowName}
                  onChange={(e) => setEditWorkflowName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  Description
                </Label>
                <Textarea
                  id="edit-description"
                  value={editWorkflowDescription}
                  onChange={(e) => setEditWorkflowDescription(e.target.value)}
                  className="col-span-3"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsEditModalOpen(false); setEditingWorkflow(null); }}>Cancel</Button>
              <Button onClick={handleUpdateWorkflow}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
