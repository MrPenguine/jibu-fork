"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@libs/shadcn-ui/components/ui/card';
import { Badge } from '@libs/shadcn-ui/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@libs/shadcn-ui/components/ui/dialog';
import { Input } from '@libs/shadcn-ui/components/ui/input';
import { Textarea } from '@libs/shadcn-ui/components/ui/textarea';
import { Label } from '@libs/shadcn-ui/components/ui/label';
import { PlusCircle, Play, Trash2, Pencil, Search, FolderPlus, Upload } from 'lucide-react';
import { agentApiClient } from '../../../../../utils/AgentApi';
import { fetchAPI } from "../../../../../utils/api";
import { useWorkspace } from '../../../../../utils/workspaceContext';
import { Skeleton } from '@libs/shadcn-ui/components/ui/skeleton';
import { workflowApi } from '../../../../../utils/workflowApi';

export default function AgentsPage() {
  const { activeWorkspace, loading } = useWorkspace();
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any | null>(null);
  const [editAgentName, setEditAgentName] = useState('');
  const [editAgentDescription, setEditAgentDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const router = useRouter();
  const routeParams = useParams<{ workspaceId: string }>();
  const workspaceId = (routeParams?.workspaceId as string) || '';

  useEffect(() => {
    const fetchAgents = async () => {
      if (!workspaceId) {
        setAgents([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const fetchedAgents = await fetchAPI(`/v1/agents?workspaceId=${workspaceId}`);
        setAgents(fetchedAgents as any[]);
      } catch (error) {
        console.error("Failed to fetch agents:", error);
        setAgents([]); // Set to empty array on error
      }
      setIsLoading(false);
    };

    fetchAgents();
  }, [workspaceId]);

  // Open the agent's content page (CMS workflows)
  const handleOpenAgent = async (agentId: string) => {
    // Store workspace ID in localStorage for the back button
    localStorage.setItem('currentWorkspaceId', workspaceId);
    // Navigate to content page
    router.push(`/agent/${agentId}/cms/workflows`);
  };

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) {
      alert("Agent name cannot be empty.");
      return;
    }
    
    try {
      // Create agent with support for multiple assistants and optional folders
      const newAgent = await agentApiClient.createAgentDefinition({
        name: newAgentName,
        description: newAgentDescription || '',
        workspaceId: workspaceId,
        nodes: [], // Empty nodes array to start with
        edges: [], // Empty edges array to start with
        // Note: We're not specifying assistantId to allow for multiple assistants
        // folderId is optional and can be null/undefined
      });
      
      setAgents(prev => [...prev, newAgent as any]);
      setIsCreateModalOpen(false);
      setNewAgentName('');
      setNewAgentDescription('');
      localStorage.setItem('currentWorkspaceId', workspaceId);
      router.push(`/agent/${newAgent.id}/cms/workflows`);
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

  const openDeleteConfirm = (agentId: string) => {
    console.log('[AgentsPage] Open delete confirm for agent:', agentId);
    setDeleteTargetId(agentId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteAgent = async () => {
    if (!deleteTargetId) return;
    console.log('[AgentsPage] Confirming delete for agent:', deleteTargetId);
    try {
      await agentApiClient.deleteAgentDefinition(deleteTargetId, workspaceId);
      setAgents(prev => prev.filter(a => a.id !== deleteTargetId));
      setDeleteConfirmOpen(false);
      setDeleteTargetId(null);
    } catch (error) {
      console.error('Failed to delete agent:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`Failed to delete agent. ${message}`);
    }
  };

  const cancelDeleteAgent = () => {
    console.log('[AgentsPage] Delete canceled by user');
    setDeleteConfirmOpen(false);
    setDeleteTargetId(null);
  };

  const filteredAgents = searchQuery
    ? agents.filter(agent => 
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (agent.description && agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : agents;

  if (loading || !activeWorkspace) {
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-gray-600">
            Create and manage automated conversation flows
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => alert('Create folder functionality coming soon')}>
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => alert('Import functionality coming soon')}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#009959] hover:bg-[#007a47] rounded-xl" onClick={() => setIsCreateModalOpen(true)}>
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
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input 
            placeholder="Search agents..." 
            className="pl-10 rounded-xl border-gray-200 focus:border-[#009959] focus:ring-[#009959]" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="container mx-auto py-6 flex justify-center items-center">
          <p>Loading agents...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-3">
              <h3 className="text-lg font-medium">No agents found</h3>
              <p className="text-sm text-muted-foreground">
                Get started by creating your first agent
              </p>
              <Button className="bg-[#009959] hover:bg-[#007a47] rounded-xl" onClick={() => setIsCreateModalOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map((agent, index) => {
            // Cycle through Palatinate, Saffron, and Cinnabar
            const colors = [
              { bg: 'bg-[#491344]', hover: 'hover:bg-[#3a0f37]', text: 'text-white' }, // Palatinate
              { bg: 'bg-[#F9C116]', hover: 'hover:bg-[#e0ad13]', text: 'text-[#22262A]' }, // Saffron
              { bg: 'bg-[#F45A10]', hover: 'hover:bg-[#d94d0d]', text: 'text-white' }, // Cinnabar
            ];
            const colorScheme = colors[index % colors.length];
            
            return (
            <Card key={agent.id} className={`rounded-2xl border-0 ${colorScheme.bg} ${colorScheme.hover} ${colorScheme.text} shadow-md transition-all duration-200 hover:shadow-xl hover:scale-105 cursor-pointer overflow-hidden`}
              onClick={() => handleOpenAgent(agent.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <CardTitle className="text-xl font-bold">{agent.name}</CardTitle>
                  <Badge 
                    variant={agent.isPublished ? 'default' : 'outline'}
                    className={`${colorScheme.text === 'text-white' ? 'bg-white/20 text-white border-white/30' : 'bg-[#222E50]/10 text-[#222E50] border-[#222E50]/20'}`}
                  >
                    {agent.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                <CardDescription className={`${colorScheme.text === 'text-white' ? 'text-white/80' : 'text-inherit opacity-80'} line-clamp-2`}>
                  {agent.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3">
                <div className={`text-sm space-y-1 ${colorScheme.text === 'text-white' ? 'text-white/70' : 'opacity-70'}`}>
                  <div>
                    <span className="font-medium">Version:</span> {agent.version || '1.0'}
                  </div>
                  <div>
                    <span className="font-medium">Updated:</span>{' '}
                    {agent.updatedAt ? new Date(agent.updatedAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </CardContent>
              <CardFooter className={`pt-3 border-t ${colorScheme.text === 'text-white' ? 'border-white/20' : 'border-black/10'}`}>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`flex-1 ${colorScheme.text === 'text-white' ? 'hover:bg-white/20 text-white' : 'hover:bg-black/10'}`}
                    onClick={(e) => { e.stopPropagation(); handleOpenEditModal(agent); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`flex-1 ${colorScheme.text === 'text-white' ? 'hover:bg-white/20 text-white' : 'hover:bg-black/10'}`}
                    onClick={(e) => { e.stopPropagation(); openDeleteConfirm(agent.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
            );
          })}
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

      {/* Delete Agent Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(v) => (v ? setDeleteConfirmOpen(true) : cancelDeleteAgent())}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this agent? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDeleteAgent}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteAgent}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
