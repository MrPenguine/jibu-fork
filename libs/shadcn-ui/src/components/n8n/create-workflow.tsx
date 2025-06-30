"use client";

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { createN8nWorkflow } from '../../../../../apps/frontend/src/utils/n8n';

interface WorkflowDetails {
  id: string;
  name: string;
  webhookUrl: string;
  active: boolean;
  nodes: any[];
  connections: any;
}

interface CreateWorkflowProps {
  onWorkflowCreated?: (workflow: WorkflowDetails) => void;
}

export function CreateWorkflow({ onWorkflowCreated }: CreateWorkflowProps) {
  const [workflowName, setWorkflowName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<WorkflowDetails | null>(null);

  const handleCreateWorkflow = async () => {
    if (!workflowName.trim()) {
      setError('Please enter a workflow name');
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const workflowTemplate = {
        name: workflowName.trim(),
        webhookPath: `webhook-${Date.now()}`,
        webhookMethod: 'POST',
        agentPrompt: 'You are a helpful AI assistant. Respond to user queries in a friendly and informative manner.',
        memoryEnabled: true,
      };

      const result = await createN8nWorkflow(workflowTemplate);
      
      const workflowDetails: WorkflowDetails = {
        id: result.id,
        name: result.name,
        webhookUrl: result.webhookUrl || '',
        active: result.active,
        nodes: result.nodes,
        connections: result.connections,
      };

      setSuccess(workflowDetails);
      setWorkflowName('');
      
      if (onWorkflowCreated) {
        onWorkflowCreated(workflowDetails);
      }
    } catch (err) {
      console.error('Error creating workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
    } finally {
      setIsCreating(false);
    }
  };

  const handleReset = () => {
    setError(null);
    setSuccess(null);
    setWorkflowName('');
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Create N8N Workflow</CardTitle>
        <CardDescription>
          Create a new AI-powered webhook workflow with Gemini model and memory integration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="workflow-name">Workflow Name</Label>
          <Input
            id="workflow-name"
            type="text"
            placeholder="Enter workflow name (e.g., Chat Assistant: MyBot)"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            disabled={isCreating}
            className="w-full"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="space-y-2">
                <p className="font-medium">Workflow created successfully!</p>
                <div className="text-sm space-y-1">
                  <p><strong>ID:</strong> {success.id}</p>
                  <p><strong>Name:</strong> {success.name}</p>
                  <p><strong>Status:</strong> {success.active ? 'Active' : 'Inactive'}</p>
                  <p><strong>Nodes:</strong> {success.nodes.length} nodes created</p>
                  {success.webhookUrl && (
                    <p><strong>Webhook URL:</strong> <code className="text-xs bg-gray-100 px-1 rounded">{success.webhookUrl}</code></p>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleCreateWorkflow}
            disabled={isCreating || !workflowName.trim()}
            className="flex-1"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Workflow...
              </>
            ) : (
              'Create Workflow'
            )}
          </Button>
          
          {(error || success) && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isCreating}
            >
              Reset
            </Button>
          )}
        </div>

        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>This workflow will include:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Webhook trigger for incoming requests</li>
            <li>Google Gemini AI model integration</li>
            <li>Memory buffer for conversation context</li>
            <li>AI Agent for processing and responses</li>
            <li>Webhook response node for replies</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}