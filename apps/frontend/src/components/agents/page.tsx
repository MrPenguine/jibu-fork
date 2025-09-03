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
import { agentApiClient } from '../../utils/AgentApi';
import { fetchAPI } from "../../utils/api";
import { useWorkspace } from '../../utils/workspaceContext';

export default function AgentsPage() {
  const { activeWorkspace } = useWorkspace();
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [editAgentName, setEditAgentName] = useState('');
  const [editAgentDescription, setEditAgentDescription] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchAgents = async () => {
      if (!activeWorkspace) {
        setAgents([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const fetchedAgents = await fetchAPI(`/v1/agents?workspaceId=${activeWorkspace.id}`);
        setAgents(fetchedAgents as any[]);
      } catch (error) {
        console.error("Failed to fetch agents:", error);
        setAgents([]); // Set to empty array on error
      }
      setIsLoading(false);
    };
    
    fetchAgents();
  }, [activeWorkspace]);

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) {
      alert("Agent name cannot be empty.");
      return;
    }
    
    try {
      const newAgent = await agentApiClient.createAgentDefinition({
        name: newAgentName,
        description: newAgentDescription,
        nodes: [], // Empty nodes array to start with
        edges: [], // Empty edges array to start with
        // Ensure TS type requirement and correct header resolution
        workspaceId: activeWorkspace?.id || ''
      }, activeWorkspace?.id);
      
      setAgents(prev => [...prev, newAgent as any]);
      setIsCreateModalOpen(false);
      setNewAgentName('');
      setNewAgentDescription('');
      router.push(`/agents/${newAgent.id}/cms/workflows`);
    } catch (error) {
      console.error("Failed to create agent:", error);
      alert("Failed to create agent. Please try again.");
    }
  };

  const handleOpenEditModal = (agent: any) => {
    setEditingAgent(agent);
    setEditAgentName(agent.name);
    setEditAgentDescription(agent.description || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateAgent = async () => {
    if (!editingAgent || !editAgentName.trim()) {
      alert("Agent name cannot be empty.");
      return;
    }
    try {
      const updatedAgentData = {
        ...editingAgent,
        name: editAgentName,
        description: editAgentDescription,
      };
      // Remove fields that should not be sent on update, or ensure API handles them
      delete updatedAgentData.createdAt; 
      delete updatedAgentData.updatedAt;
      delete updatedAgentData.id; // ID is in the URL path

      const updated = await agentApiClient.updateAgentDefinition(editingAgent.id, updatedAgentData);
      setAgents(agents.map(wf => wf.id === editingAgent.id ? { ...wf, ...updated } : wf));
      setIsEditModalOpen(false);
      setEditingAgent(null);
    } catch (error) {
      console.error("Failed to update agent:", error);
      alert("Failed to update agent. Please try again.");
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (window.confirm("Are you sure you want to delete this agent? This action cannot be undone.")) {
      try {
        // Pass explicit workspaceId to ensure correct headers (auth + workspace)
        await agentApiClient.deleteAgentDefinition(agentId, activeWorkspace?.id);
        setAgents(agents.filter(wf => wf.id !== agentId));
      } catch (error) {
        console.error("Failed to delete agent:", error);
        alert("Failed to delete agent. Please try again.");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex justify-center items-center">
        <p>Loading agents...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-muted-foreground">
            Create and manage automated conversation flows
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
              <DialogDescription>
                Enter the details for your new agent. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="col-span-3"
                  placeholder="My Awesome Agent"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Input
                  id="description"
                  value={newAgentDescription}
                  onChange={(e) => setNewAgentDescription(e.target.value)}
                  className="col-span-3"
                  placeholder="Optional: Describe what this agent does"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateAgent}>Save Agent</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!isLoading && agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-3">
              <h3 className="text-lg font-medium">No agents found</h3>
              <p className="text-sm text-muted-foreground">
                Get started by creating your first agent
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="truncate">{agent.name}</CardTitle>
                  <Badge variant={agent.isPublished ? 'default' : 'outline'}>
                    {agent.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                <CardDescription className="truncate">{agent.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <div>
                    <span className="text-muted-foreground">Version:</span> {agent.version}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last updated:</span>{' '}
                    {new Date(agent.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/agents/${agent.id}/cms/workflows`}>
                      <Edit className="mr-2 h-4 w-4" /> View/Design
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(agent)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteAgent(agent.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Agent Modal */}
      {editingAgent && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Agent</DialogTitle>
              <DialogDescription>
                Update the name and description for your agent. Click save when done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">
                  Name
                </Label>
                <Input
                  id="edit-name"
                  value={editAgentName}
                  onChange={(e) => setEditAgentName(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  Description
                </Label>
                <Textarea
                  id="edit-description"
                  value={editAgentDescription}
                  onChange={(e) => setEditAgentDescription(e.target.value)}
                  className="col-span-3"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsEditModalOpen(false); setEditingAgent(null); }}>Cancel</Button>
              <Button onClick={handleUpdateAgent}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
