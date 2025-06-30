"use client";

import React, { useState } from 'react';
import { CreateWorkflow } from '../../../../../../libs/shadcn-ui/src/components/n8n/create-workflow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../../libs/shadcn-ui/src/components/ui/card';
import { Alert, AlertDescription } from '../../../../../../libs/shadcn-ui/src/components/ui/alert';
import { Badge } from '../../../../../../libs/shadcn-ui/src/components/ui/badge';
import { Button } from '../../../../../../libs/shadcn-ui/src/components/ui/button';
import { CheckCircle, AlertCircle, Trash2, Play, Pause } from 'lucide-react';
import { 
  checkN8nStatus, 
  getAllN8nWorkflows, 
  deleteN8nWorkflow, 
  activateN8nWorkflow, 
  deactivateN8nWorkflow,
  testN8nWebhook,
  extractWebhookUrl
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

  const handleWorkflowCreated = (workflow: WorkflowDetails) => {
    setWorkflows(prev => [...prev, workflow]);
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

  const handleTestWebhook = async (webhookUrl: string, workflowId: string) => {
    if (!webhookUrl) {
      setTestError('No webhook URL available for this workflow');
      return;
    }

    try {
      setTestLoading(true);
      setTestResult(null);
      setTestError(null);
      
      // Use useTestUrl=true flag to allow N8N test mode webhook testing
      const result = await testN8nWebhook(
        webhookUrl, 
        workflowId, 
        {
          message: 'Hi there',
          sessionId: `test-session-${Date.now()}`,
        },
        // Add custom headers for webhook test (optional)
        { 'X-Test-Header': 'test-value' }, 
        // Use the test URL option for N8N test mode
        true
      );
      
      setTestResult(result);
    } catch (err) {
      console.error('Error testing webhook:', err);
      setTestError(err instanceof Error ? err.message : 'Unknown error');
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
                            onClick={() => handleTestWebhook(workflow.webhookUrl, workflow.id)}
                          >
                            Test Webhook
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