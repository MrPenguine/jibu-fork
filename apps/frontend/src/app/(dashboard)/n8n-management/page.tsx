"use client";

import React, { useState } from 'react';
import { Button } from '../../../../../../libs/shadcn-ui/src/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../../../../../../libs/shadcn-ui/src/components/ui/card';
import { Separator } from '../../../../../../libs/shadcn-ui/src/components/ui/separator';
import { useToast } from '../../../../../../libs/shadcn-ui/src/components/ui/use-toast';
import { CreateWorkflow } from '../../../../../../libs/shadcn-ui/src/components/n8n/create-workflow';
import { Alert, AlertDescription } from '../../../../../../libs/shadcn-ui/src/components/ui/alert';
import { Badge } from '../../../../../../libs/shadcn-ui/src/components/ui/badge';
import { AlertCircle, CheckCircle, Trash2, Play, Pause } 
from 'lucide-react';
import { 
  checkN8nStatus, 
  getAllN8nWorkflows, 
  deleteN8nWorkflow, 
  activateN8nWorkflow, 
  deactivateN8nWorkflow,
  updateN8nWorkflowPrompt,
  testN8nWebhook,
  extractWebhookUrl,
  finalizeN8nWebhookSetup,
  N8nWorkflowResponse
} from '../../../utils/n8n';

interface WorkflowDetails {
  id: string;
  name: string;
  webhookUrl: string;
  active: boolean;
  nodes: any[];
  connections: any;
}

export default function N8nManagementPage() {
  const [workflows, setWorkflows] = useState<WorkflowDetails[]>([]);
  const [n8nStatus, setN8nStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [finalizingWorkflows, setFinalizingWorkflows] = useState<string[]>([]);
  
  const { toast } = useToast();

  // Check N8N status on component mount
  React.useEffect(() => {
    checkStatus();
    loadWorkflows();
  }, []);

  const checkStatus = async () => {
    try {
      setN8nStatus('checking');
      const status = await checkN8nStatus();
      setN8nStatus(status.status);
    } catch (err) {
      console.error('Error checking N8N status:', err);
      setN8nStatus('disconnected');
    }
  };

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const response = await getAllN8nWorkflows();
      
      // Handle different response structures from N8N API
      let workflowsData: any[] = [];
      if (Array.isArray(response)) {
        workflowsData = response;
      } else if (response && typeof response === 'object' && 'data' in response && Array.isArray((response as any).data)) {
        workflowsData = (response as any).data;
      } else if (response && typeof response === 'object' && 'workflows' in response && Array.isArray((response as any).workflows)) {
        workflowsData = (response as any).workflows;
      } else {
        console.error('Unexpected response structure:', response);
        workflowsData = [];
      }
      
      const workflowsWithUrls = workflowsData.map((workflow: any) => ({
        ...workflow,
        webhookUrl: extractWebhookUrl(workflow),
      }));
      setWorkflows(workflowsWithUrls);
      setError(null);
    } catch (err) {
      console.error('Error loading workflows:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkflowCreated = async (workflow: WorkflowDetails) => {
    let workflowId: string | undefined;
    try {
      workflowId = workflow.id;

      toast({
        title: "Workflow Created",
        description: `Workflow '${workflow.name}' created. Starting activation...`,
      });

      setFinalizingWorkflows(prev => [...prev, workflowId!]);
      loadWorkflows(); // Refresh list to show the new workflow immediately

      await activateN8nWorkflow(workflowId);
      toast({
        title: "Workflow Activated",
        description: `Re-saving to register webhook...`,
      });

      // The prompt is part of the workflow object passed from the creation component
      const setNode = workflow.nodes.find((node: any) => node.name === 'Set');
      const prompt = setNode?.parameters?.values?.string[0]?.value || 'Default prompt if not found';
      
      await updateN8nWorkflowPrompt(workflowId, prompt);
      toast({
        title: "Workflow Re-saved",
        description: `Polling for webhook readiness...`,
      });

      await finalizeN8nWebhookSetup(workflowId);

      toast({
        title: "Setup Complete!",
        description: `Webhook for '${workflow.name}' is now active and ready!`,
        variant: "success",
      });

      loadWorkflows(); // Final refresh to get latest status

    } catch (error: any) {
      console.error('Error during workflow setup:', error);
      toast({
        title: "Setup Failed",
        description: error.response?.data?.message || 'An error occurred during workflow setup.',
        variant: "destructive",
      });
    } finally {
      if (workflowId) {
        setFinalizingWorkflows(prev => prev.filter(id => id !== workflowId));
      }
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) {
      return;
    }

    try {
      await deleteN8nWorkflow(id);
      setWorkflows(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      console.error('Error deleting workflow:', err);
      alert('Failed to delete workflow');
    }
  };

  const handleToggleWorkflow = async (id: string, currentActive: boolean) => {
    try {
      if (currentActive) {
        await deactivateN8nWorkflow(id);
      } else {
        await activateN8nWorkflow(id);
      }
      
      setWorkflows(prev => prev.map(w => 
        w.id === id ? { ...w, active: !currentActive } : w
      ));
    } catch (err) {
      console.error('Error toggling workflow:', err);
      alert('Failed to toggle workflow status');
    }
  };

  const fetchAndRefreshWorkflows = async () => {
    setLoading(true);
    try {
      console.log('Refreshing workflow list from server...');
      const freshWorkflows = await getAllN8nWorkflows();
      console.log('Fetched workflows:', freshWorkflows);
      // Cast or transform to ensure type compatibility
      setWorkflows(freshWorkflows?.map((wf: any) => ({
        ...wf,
        // Ensure webhookUrl is never undefined
        webhookUrl: wf.webhookUrl || '',
      })) || []);
      toast({
        title: "Success",
        description: "Workflow list refreshed",
      });
      return freshWorkflows;
    } catch (error) {
      console.error('Failed to refresh workflow list:', error);
      toast({
        title: "Error",
        description: "Failed to refresh workflow list",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhook = async (workflow: any) => {
    if (!workflow || !workflow.id) {
      toast({
        title: "Error",
        description: "No workflow ID found",
        variant: "destructive",
      });
      return;
    }

    console.log('Testing webhook for workflow from UI:', workflow);
    
    // Get the latest workflow data directly from server
    try {
      // Use existing function to get workflow by ID
      const allWorkflows = await getAllN8nWorkflows();
      const freshWorkflow = allWorkflows.find(w => w.id === workflow.id);
      console.log('Fresh workflow data from server:', freshWorkflow);
      
      if (!freshWorkflow) {
        console.warn('Fresh workflow not found on server! Will try with UI data anyway.');
      } else {
        console.log('Using fresh workflow data for test with ID:', freshWorkflow.id);
        // Update UI workflow with fresh data
        workflow = freshWorkflow;
      }
    } catch (freshError) {
      console.error('Failed to get fresh workflow data:', freshError);
      console.warn('Continuing with UI workflow data');
    }

    setTestLoading(true);
    try {
      console.log('Testing webhook for workflow ID:', workflow.id, 'with URL:', workflow.webhookUrl);
      const result = await testN8nWebhook(
        workflow.webhookUrl,
        workflow.id,
        {
          message: "Hello, can you help me schedule an appointment?",
        }
      );

      setTestResult(result);
      toast({
        title: "Success",
        description: "Webhook test succeeded",
      });
      console.log("Webhook test result:", result);
    } catch (error: any) {
      console.error("Error testing webhook:", error);
      setTestError(error.message || "Failed to test webhook");
      toast({
        title: "Error",
        description: error.message || "Failed to test webhook",
        variant: "destructive",
      });
      
      // If test fails, try refreshing workflows and try again
      if (confirm('Webhook test failed. Would you like to refresh workflows and try again?')) {
        const refreshedWorkflows = await fetchAndRefreshWorkflows();
        if (refreshedWorkflows) {
          const refreshedWorkflow = refreshedWorkflows.find((w: any) => w.id === workflow.id);
          if (refreshedWorkflow) {
            handleTestWebhook(refreshedWorkflow);
          }
        }
      }
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">N8N Management</h1>
          <p className="text-gray-600 mt-2">
            Create and manage N8N workflows for AI-powered automation
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge 
            variant={n8nStatus === 'connected' ? 'default' : 'destructive'}
            className="flex items-center gap-1"
          >
            {n8nStatus === 'connected' ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            N8N {n8nStatus === 'checking' ? 'Checking...' : n8nStatus}
          </Badge>
          <Button onClick={checkStatus} variant="outline" size="sm">
            Refresh Status
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Workflow Section */}
        <div>
          <CreateWorkflow onWorkflowCreated={handleWorkflowCreated} />
        </div>

        {/* Existing Workflows Section */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Existing Workflows</CardTitle>
              <CardDescription>
                Manage your existing N8N workflows
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center text-gray-500">Loading workflows...</p>
              ) : workflows.length === 0 ? (
                <p className="text-center text-gray-500">No workflows found</p>
              ) : (
                <div className="space-y-4">
                  {workflows.map((workflow) => (
                    <div key={workflow.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{workflow.name}</h3>
                          <p className="text-sm text-gray-500">ID: {workflow.id}</p>
                        </div>
                        <Badge variant={workflow.active ? 'default' : 'secondary'}>
                          {workflow.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      <div className="text-sm space-y-1">
                        <p><strong>Nodes:</strong> {workflow.nodes?.length || 'N/A'}</p>
                        {workflow.webhookUrl && (
                          <p className="break-all">
                            <strong>Webhook:</strong> 
                            <code className="text-xs bg-gray-100 px-1 rounded ml-1">
                              {workflow.webhookUrl}
                            </code>
                          </p>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleWorkflow(workflow.id, workflow.active)}
                        >
                          {workflow.active ? (
                            <><Pause className="h-3 w-3 mr-1" /> Deactivate</>
                          ) : (
                            <><Play className="h-3 w-3 mr-1" /> Activate</>
                          )}
                        </Button>
                        
                        {workflow.webhookUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestWebhook(workflow)}
                            disabled={finalizingWorkflows.includes(workflow.id) || testLoading}
                          >
                            {finalizingWorkflows.includes(workflow.id) ? 'Finalizing...' : 'Test Webhook'}
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteWorkflow(workflow.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-4">
                <Button onClick={loadWorkflows} variant="outline" className="w-full">
                  Refresh Workflows
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Test Results Section */}
      {(testResult || testLoading || testError) && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              {testLoading && (
                <div className="text-center py-4">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mb-2"></div>
                  <p>Testing webhook...</p>
                </div>
              )}
              
              {testError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{testError}</AlertDescription>
                </Alert>
              )}
              
              {testResult && (
                <div className="space-y-3">
                  <div className="rounded-md bg-green-50 p-4 border border-green-200">
                    <div className="flex">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                      <p className="ml-3 text-sm text-green-700">Webhook test successful!</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium mb-1">Response:</p>
                    <div className="bg-gray-100 p-3 rounded-md overflow-x-auto">
                      <pre className="text-xs">{JSON.stringify(testResult, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>About This Test Page</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>
              This is a test page for creating and managing N8N workflows. Each workflow created here includes:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Webhook trigger for receiving HTTP requests</li>
              <li>Google Gemini AI model for natural language processing</li>
              <li>Memory buffer for maintaining conversation context</li>
              <li>AI Agent for processing and generating responses</li>
              <li>Webhook response node for sending replies</li>
            </ul>
            <p className="mt-4">
              Use this page to test workflow creation before integrating the functionality into your main application.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}