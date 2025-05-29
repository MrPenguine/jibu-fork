"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Input } from '@libs/shadcn-ui/components/ui/input';
import { Textarea } from '@libs/shadcn-ui/components/ui/textarea';
import { Checkbox } from '@libs/shadcn-ui/components/ui/checkbox';
import { Label } from '@libs/shadcn-ui/components/ui/label';
import { workflowApi, Workflow } from '../../../../utils/workflowApi';
import { WorkflowDesignerWithProvider } from '@jibu/reactflow-workflow-editor'; // Assuming this is the correct path
import { toast } from 'sonner'; // Or your preferred toast library

// Mock assistantId - replace with actual logic
const MOCK_ASSISTANT_ID = 'assistant_123';

export default function WorkflowDetailPage() {
  const router = useRouter();
  const params = useParams();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [nodes, setNodes] = useState<any[]>([]); // Adjust type as per your reactflow setup
  const [edges, setEdges] = useState<any[]>([]); // Adjust type as per your reactflow setup
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchWorkflowData = useCallback(async () => {
    if (!workflowId) return;
    setIsLoading(true);
    try {
      const data = await workflowApi.getWorkflowById(workflowId);
      setWorkflow(data);
      setWorkflowName(data.name);
      setWorkflowDescription(data.description || '');
      setIsPublished(data.isPublished);
      // Assuming workflow data contains nodes and edges for the designer
      setNodes(data.definition?.nodes || []); 
      setEdges(data.definition?.edges || []);
    } catch (error) {
      console.error('Failed to fetch workflow:', error);
      toast.error('Failed to load workflow details.');
      // Optionally redirect if workflow not found or error occurs
      // router.push('/workflows'); 
    }
    setIsLoading(false);
  }, [workflowId]);

  useEffect(() => {
    fetchWorkflowData();
  }, [fetchWorkflowData]);

  const handleSaveWorkflow = async () => {
    if (!workflow) return;
    setIsSaving(true);
    try {
      const updatedWorkflowData = {
        name: workflowName,
        description: workflowDescription,
        isPublished: isPublished,
        definition: { nodes, edges }, // Save current state of the designer
        // assistantId should ideally be part of the workflow object or handled by the API
        assistantId: workflow.assistantId || MOCK_ASSISTANT_ID, 
      };
      await workflowApi.updateWorkflow(workflowId, updatedWorkflowData);
      toast.success('Workflow saved successfully!');
      // Optionally refetch or update local state more granularly
      fetchWorkflowData(); 
    } catch (error) {
      console.error('Failed to save workflow:', error);
      toast.error('Failed to save workflow.');
    }
    setIsSaving(false);
  };

  const handleDeleteWorkflow = async () => {
    if (!workflowId) return;
    if (!confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
      return;
    }
    setIsDeleting(true);
    try {
      await workflowApi.deleteWorkflow(workflowId);
      toast.success('Workflow deleted successfully!');
      router.push('/workflows');
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      toast.error('Failed to delete workflow.');
    }
    setIsDeleting(false);
  };
  
  // Placeholder for Run functionality - to be integrated later
  const handleRunWorkflow = () => {
    toast.info('Run functionality will be implemented here.');
    // This could open a modal, a new tab, or display results in a panel
  };

  if (isLoading) {
    return <div className="container mx-auto py-6 text-center">Loading workflow...</div>;
  }

  if (!workflow) {
    return <div className="container mx-auto py-6 text-center">Workflow not found.</div>;
  }

  return (
    <div className="container mx-auto py-6 flex flex-col h-[calc(100vh-theme(spacing.16))]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Edit Workflow: {workflow.name}</h1>
          <p className="text-muted-foreground">
            Modify the workflow details and design.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSaveWorkflow} disabled={isSaving || isDeleting}>
            {isSaving ? 'Saving...' : 'Save Workflow'}
          </Button>
          <Button variant="outline" onClick={handleRunWorkflow} disabled={!isPublished || isSaving || isDeleting}>
            Run Workflow
          </Button>
          <Button variant="destructive" onClick={handleDeleteWorkflow} disabled={isSaving || isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Workflow'}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 flex-grow">
        {/* Workflow Settings Panel */}
        <div className="md:col-span-1 space-y-6 bg-card p-6 rounded-lg shadow">
          <div>
            <Label htmlFor="workflowName">Workflow Name</Label>
            <Input 
              id="workflowName" 
              value={workflowName} 
              onChange={(e) => setWorkflowName(e.target.value)} 
              placeholder="Enter workflow name"
            />
          </div>
          <div>
            <Label htmlFor="workflowDescription">Description</Label>
            <Textarea 
              id="workflowDescription" 
              value={workflowDescription} 
              onChange={(e) => setWorkflowDescription(e.target.value)} 
              placeholder="Enter workflow description (optional)"
              rows={3}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="isPublished" 
              checked={isPublished} 
              onCheckedChange={(checked) => setIsPublished(checked as boolean)} 
            />
            <Label htmlFor="isPublished">Publish Workflow</Label>
          </div>
          {/* Add more settings as needed */}
        </div>

        {/* Workflow Designer */}
        <div className="md:col-span-2 bg-card p-1 rounded-lg shadow flex flex-col h-full">
          <WorkflowDesignerWithProvider
            nodes={nodes}
            edges={edges}
            onNodesChange={setNodes} // Or use the reactflow onNodesChange handler
            onEdgesChange={setEdges} // Or use the reactflow onEdgesChange handler
            // onConnect, onLayout, etc. as needed by your designer component
            // assistantId={workflow.assistantId || MOCK_ASSISTANT_ID} // Pass assistantId if required by the designer
            // Ensure the designer can handle initial empty nodes/edges if creating new
          />
        </div>
      </div>
    </div>
  );
}