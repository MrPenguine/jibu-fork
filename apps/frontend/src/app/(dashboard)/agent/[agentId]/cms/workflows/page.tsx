"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@libs/shadcn-ui/components/ui/card';
import { Skeleton } from '@libs/shadcn-ui/components/ui/skeleton';
import { Plus, Edit, Play, Trash2 } from 'lucide-react';
import { fetchAPI } from '../../../../../../utils/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@libs/shadcn-ui/components/ui/dialog';
import { Input } from '@libs/shadcn-ui/components/ui/input';
import { Label } from '@libs/shadcn-ui/components/ui/label';
import { Textarea } from '@libs/shadcn-ui/components/ui/textarea';
import { workflowApi } from '../../../../../../utils/workflowApi';
import { getActiveWorkspaceId } from '../../../../../../utils/fileApi';
interface UIWorkflow {
  id: string;
  name: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isPrimary?: boolean;
  workflowType?: 'MASTER' | 'SECONDARY';
  isPublished?: boolean;
}

export default function AgentWorkflowsPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = (params?.agentId as string) || '';
  const [isLoading, setIsLoading] = useState(true);
  const [workflows, setWorkflows] = useState<UIWorkflow[]>([]);
  const [agentName, setAgentName] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const router = useRouter();
  const workspaceId = useMemo(() => getActiveWorkspaceId() || '', []);

  useEffect(() => {
    const fetchData = async () => {
      if (!agentId) {
        router.push('/workspace');
        return;
      }
      setIsLoading(true);
      try {
        const [agentRes, workflowsRes] = await Promise.all([
          fetchAPI(`/v1/agents/${agentId}`),
          workflowApi.getWorkflowsByAssistant(agentId),
        ]);
        if (agentRes && agentRes.name) setAgentName(agentRes.name);
        setWorkflows((workflowsRes as unknown as UIWorkflow[]) || []);
      } catch (error) {
        console.error('Failed to fetch agent/workflows:', error);
        setWorkflows([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [agentId, router]);

  const masterWorkflow = useMemo(
    () => workflows.find(w => w.isPrimary || w.workflowType === 'MASTER'),
    [workflows]
  );
  const secondaryWorkflows = useMemo(
    () => workflows.filter(w => !w.isPrimary),
    [workflows]
  );

  const handleCreateWorkflow = () => {
    setIsCreateModalOpen(true);
  };

  const handleSaveWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      alert('Workflow name cannot be empty.');
      return;
    }
    try {
      await workflowApi.createWorkflow(
        {
          name: newWorkflowName,
          description: newWorkflowDescription || undefined,
          assistantId: agentId,
          masterWorkflowId: masterWorkflow?.id,
        }
      );
      // Refetch workflows to ensure we have server-shaped data (createdAt/updatedAt, links)
      const workflowsRes = await workflowApi.getWorkflowsByAssistant(agentId);
      setWorkflows((workflowsRes as unknown as UIWorkflow[]) || []);
      setIsCreateModalOpen(false);
      setNewWorkflowName('');
      setNewWorkflowDescription('');
    } catch (error) {
      console.error('Failed to create workflow:', error);
      alert('Failed to create workflow. Please try again.');
    }
  };

  const handleEditWorkflow = (workflowId: string) => {
    router.push(`/agent/${agentId}/canvas/${workflowId}`);
  };

  const handleRunWorkflow = (workflowId: string) => {
    router.push(`/agent/${agentId}/workflows/${workflowId}/run`);
  };

  const openDeleteConfirm = (workflowId: string) => {
    console.log('[AgentWorkflowsPage] Open delete confirm for workflow:', workflowId);
    setDeleteTargetId(workflowId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteWorkflow = async () => {
    if (!deleteTargetId) return;
    console.log('[AgentWorkflowsPage] Confirming delete for workflow:', deleteTargetId);
    try {
      await workflowApi.deleteWorkflow(deleteTargetId, workspaceId);
      setWorkflows(prev => prev.filter(wf => wf.id !== deleteTargetId));
      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`Failed to delete workflow. ${message}`);
    }
  };

  const cancelDeleteWorkflow = () => {
    console.log('[AgentWorkflowsPage] Delete canceled by user');
    setDeleteConfirmOpen(false);
    setDeleteTargetId(null);
  };

  const togglePublish = async (wf: UIWorkflow) => {
    try {
      const updated = wf.isPublished
        ? await workflowApi.unpublishWorkflow(wf.id)
        : await workflowApi.publishWorkflow(wf.id);
      setWorkflows(prev => prev.map(x => (x.id === wf.id ? { ...x, ...(updated || {}), isPublished: !wf.isPublished } : x)));
    } catch (e) {
      console.error('Failed to toggle publish:', e);
      alert('Failed to update workflow status.');
    }
  };

  if (isLoading) {
    return (
      <div className="w-full px-6 pb-6 pt-0 bg-white text-slate-900">
        <Skeleton className="h-10 w-1/3" />
        <div className="mt-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 pb-6 pt-0 bg-white text-slate-900">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-gray-600">Manage workflows for {agentName || 'this agent'}</p>
        </div>
      </div>

      {/* Master Workflow */}
      {masterWorkflow ? (
        <div className="mb-8">
          <Card className="rounded-2xl border border-gray-200 shadow-sm bg-gray-50 hover:bg-gray-100 hover:shadow-md transition-all overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900 text-xl">Main Agent Workflow</CardTitle>
                  <CardDescription className="text-gray-600">{masterWorkflow.description || 'Primary workflow for this agent'}</CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                  <Button
                    variant={masterWorkflow.isPublished ? 'secondary' : 'default'}
                    size="sm"
                    className={`rounded-lg text-xs h-8 px-3 ${masterWorkflow.isPublished ? 'bg-gray-500 hover:bg-gray-600' : 'bg-[#009959] hover:bg-[#007a47]'}`}
                    onClick={() => togglePublish(masterWorkflow)}
                  >
                    {masterWorkflow.isPublished ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-500 mb-4">Last updated: {masterWorkflow?.updatedAt ? new Date(masterWorkflow.updatedAt).toLocaleDateString() : '—'}</div>
              <div className="flex gap-2">
                <Button type="button" size="sm" className="bg-[#009959] hover:bg-[#007a47] text-white rounded-xl" onClick={() => handleEditWorkflow(masterWorkflow.id)}>
                  <Edit className="h-4 w-4 mr-2" /> Edit
                </Button>
                <Button type="button" size="sm" className="bg-[#F9C116] hover:bg-[#e0ad13] text-[#22262A] rounded-xl" onClick={() => handleRunWorkflow(masterWorkflow.id)}>
                  <Play className="h-4 w-4 mr-2" /> Run
                </Button>
                <Button type="button" size="sm" className="bg-[#ED1B33] hover:bg-[#d11829] text-white rounded-xl" onClick={() => openDeleteConfirm(masterWorkflow.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="mb-8">
          <Card className="rounded-2xl border border-gray-200 shadow-sm">
            <CardContent className="py-8 text-center">
              <p className="text-gray-600 mb-4">No main workflow yet</p>
              <Button className="bg-[#009959] hover:bg-[#007a47] rounded-xl" onClick={handleCreateWorkflow}>
                <Plus className="mr-2 h-4 w-4" /> Create Master Workflow
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Secondary Workflows */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Secondary Workflows</h2>
        <Button className="bg-[#009959] hover:bg-[#007a47] rounded-xl" onClick={handleCreateWorkflow}>
          <Plus className="mr-2 h-4 w-4" /> Create Workflow
        </Button>
      </div>

      {secondaryWorkflows.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <p className="text-gray-600 mb-4">No secondary workflows found</p>
            <Button className="bg-[#009959] hover:bg-[#007a47] rounded-xl" onClick={handleCreateWorkflow}>
              <Plus className="mr-2 h-4 w-4" /> Create Secondary Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {secondaryWorkflows.map((workflow, index) => {
            return (
            <Card key={workflow.id} className="rounded-2xl border border-gray-200 bg-gray-50 hover:bg-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
              <CardHeader>
                <CardTitle className="text-gray-900 text-lg">{workflow.name}</CardTitle>
                <CardDescription className="text-gray-600 line-clamp-2">{workflow.description || 'Secondary workflow'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-500 mb-4">Last updated: {workflow?.updatedAt ? new Date(workflow.updatedAt).toLocaleDateString() : '—'}</div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" className="flex-1 bg-[#009959] hover:bg-[#007a47] text-white rounded-xl" onClick={() => handleEditWorkflow(workflow.id)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" className="flex-1 bg-[#F9C116] hover:bg-[#e0ad13] text-[#22262A] rounded-xl" onClick={() => handleRunWorkflow(workflow.id)}>
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" className="flex-1 bg-[#ED1B33] hover:bg-[#d11829] text-white rounded-xl" onClick={() => openDeleteConfirm(workflow.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* Create Workflow Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Enter a name and optional description for the new workflow. It will be created under Secondary Workflows for this agent.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="wf-name" className="text-right">Name</Label>
              <Input id="wf-name" value={newWorkflowName} onChange={(e) => setNewWorkflowName(e.target.value)} className="col-span-3" placeholder="My Workflow" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="wf-description" className="text-right">Description</Label>
              <Textarea id="wf-description" rows={3} value={newWorkflowDescription} onChange={(e) => setNewWorkflowDescription(e.target.value)} className="col-span-3" placeholder="Optional: Describe what this workflow does" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveWorkflow}>Save Workflow</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(v) => (v ? setDeleteConfirmOpen(true) : cancelDeleteWorkflow())}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Workflow</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this workflow? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDeleteWorkflow}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteWorkflow}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
