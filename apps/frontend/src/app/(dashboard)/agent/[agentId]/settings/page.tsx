"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Input } from '@libs/shadcn-ui/components/ui/input';
import { Label } from '@libs/shadcn-ui/components/ui/label';
import { Textarea } from '@libs/shadcn-ui/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@libs/shadcn-ui/components/ui/card';
import { Skeleton } from '@libs/shadcn-ui/components/ui/skeleton';
import { agentApiClient } from '../../../../../utils/AgentApi';

export default function AgentSettingsPage({ params }: { params: { agentId: string } }) {
  const [isLoading, setIsLoading] = useState(true);
  const [agent, setAgent] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchAgentDetails = async () => {
      if (!params.agentId) {
        router.push('/workspace');
        return;
      }

      try {
        setIsLoading(true);
        const agentData = await agentApiClient.getAgentDefinition(params.agentId);
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
  }, [params.agentId, router]);

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
      delete updatedAgentData.createdAt;
      delete updatedAgentData.updatedAt;
      delete updatedAgentData.id;

      await agentApiClient.updateAgentDefinition(params.agentId, updatedAgentData);
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
    <div className="w-full px-6 pb-6 pt-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Agent Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
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
    </div>
  );
}
