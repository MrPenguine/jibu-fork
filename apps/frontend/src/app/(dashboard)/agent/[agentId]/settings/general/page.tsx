"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Input } from '@libs/shadcn-ui/components/ui/input';
import { Label } from '@libs/shadcn-ui/components/ui/label';
import { Textarea } from '@libs/shadcn-ui/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@libs/shadcn-ui/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter as DialogFooterUI, DialogHeader, DialogTitle } from '@libs/shadcn-ui/components/ui/dialog';
import { Skeleton } from '@libs/shadcn-ui/components/ui/skeleton';
import { agentApiClient } from '../../../../../../utils/AgentApi';

export default function AgentGeneralSettingsPage({ params }: { params: Promise<{ agentId: string }> }) {
  // Unwrap the params Promise per Next.js guidance
  const { agentId } = React.use(params);
  const [isLoading, setIsLoading] = useState(true);
  const [agent, setAgent] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchAgentDetails = async () => {
      if (!agentId) {
        router.push('/workspace');
        return;
      }

      try {
        setIsLoading(true);
        const agentData = await agentApiClient.getAgentDefinition(agentId);
        setAgent(agentData);
        setName(agentData.name || '');
        setDescription(agentData.description || '');
      } catch (error) {
        console.error("Failed to fetch agent details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgentDetails();
  }, [agentId, router]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Agent name cannot be empty.");
      return;
    }

    try {
      setIsSaving(true);
      const updatedAgentData = {
        ...agent,
        name,
        description,
      };
      // Remove fields that should not be sent on update
      delete (updatedAgentData as any).createdAt;
      delete (updatedAgentData as any).updatedAt;
      delete (updatedAgentData as any).id;

      await agentApiClient.updateAgentDefinition(agentId, updatedAgentData);
      alert("Agent settings updated successfully!");
    } catch (error) {
      console.error("Failed to update agent settings:", error);
      alert("Failed to update agent settings. Please try again.");
    } finally {
      setIsSaving(false);
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
    <div className="w-full px-6 pb-6 pt-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">General</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Info</CardTitle>
          <CardDescription>Update your agent's basic information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Agent name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Describe what this agent does"
              rows={4}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>

      {/* Metadata */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>Internal identifiers for debugging and support</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">Agent ID</div>
                <div className="font-mono break-all">{agent?.id || agentId}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Version ID</div>
                <div className="font-mono break-all">{agent?.versionId || agent?.version?.id || '—'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <div className="mt-6">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
            <CardDescription>Delete this agent and all its data. This action cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Permanently delete this agent. You will be asked to confirm.
              </div>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => {
        setDeleteOpen(o);
        if (!o) setConfirmName('');
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              Your project will be permanently deleted with no chance of recovery. Type <span className="font-medium">{agent?.name || 'this agent'}</span> to the input below and confirm.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Input
              placeholder="Enter agent name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
          </div>
          <DialogFooterUI className="mt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!agent?.name || confirmName !== agent?.name}
              onClick={async () => {
                try {
                  await agentApiClient.deleteAgentDefinition(agentId);
                  setDeleteOpen(false);
                  router.push('/workspace');
                } catch (err) {
                  console.error('Failed to delete agent:', err);
                  alert('Failed to delete agent. Please try again.');
                } finally {
                  setConfirmName('');
                }
              }}
            >
              Delete forever
            </Button>
          </DialogFooterUI>
        </DialogContent>
      </Dialog>
    </div>
  );
}
