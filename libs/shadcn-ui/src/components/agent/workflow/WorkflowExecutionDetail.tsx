import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Spinner } from '../../../components/ui/spinner';
import { useWorkflowExecutions } from '../../../hooks/useWorkflowExecutions';

interface WorkflowExecutionDetailProps {
  agentId: string;
  executionId: string;
  detailed?: boolean;
}

export function WorkflowExecutionDetail({ agentId, executionId, detailed = false }: WorkflowExecutionDetailProps) {
  const { loading, error, fetchExecutionDetails, rerunExecution } = useWorkflowExecutions();
  const [executionDetails, setExecutionDetails] = useState<any | null>(null);
  const [rerunning, setRerunning] = useState(false);

  useEffect(() => {
    const loadExecutionDetails = async () => {
      try {
        const details = await fetchExecutionDetails(executionId);
        setExecutionDetails(details);
      } catch (err) {
        console.error('Failed to load execution details:', err);
      }
    };

    loadExecutionDetails();
  }, [executionId, fetchExecutionDetails]);

  const handleRerun = async () => {
    try {
      setRerunning(true);
      await rerunExecution(executionId);
      
      // Refresh execution details after rerunning
      const details = await fetchExecutionDetails(executionId);
      setExecutionDetails(details);
    } catch (err) {
      console.error('Failed to rerun execution:', err);
    } finally {
      setRerunning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'running':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="h-3 w-3 mr-1 animate-pulse" />
            Running
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  if (loading && !executionDetails) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center items-center py-8">
            <Spinner className="text-blue-500 h-8 w-8" />
            <span className="ml-2">Loading execution details...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
            <p>Failed to load execution details. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!executionDetails) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center p-8 border border-dashed rounded-md">
            <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-2" />
            <h3 className="text-lg font-medium">No execution details available</h3>
            <p className="text-gray-500">The execution details could not be found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center">
                {executionDetails.workflowName}
                <span className="ml-2">{getStatusBadge(executionDetails.status)}</span>
              </h2>
              <p className="text-sm text-gray-500">Execution ID: {executionId}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Started At</h3>
                <p className="text-sm">
                  {format(new Date(executionDetails.startedAt), 'MMM d, yyyy HH:mm:ss')}
                </p>
              </div>
              
              {executionDetails.completedAt && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Completed At</h3>
                  <p className="text-sm">
                    {format(new Date(executionDetails.completedAt), 'MMM d, yyyy HH:mm:ss')}
                  </p>
                </div>
              )}
              
              {executionDetails.duration !== undefined && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Duration</h3>
                  <p className="text-sm">{(executionDetails.duration / 1000).toFixed(2)} seconds</p>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium text-gray-500">Node Count</h3>
                <p className="text-sm">{executionDetails.nodes?.length || 0} nodes</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2 md:items-start">
            <Button
              variant="outline"
              onClick={handleRerun}
              disabled={rerunning || executionDetails.status === 'running'}
            >
              {rerunning ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Rerunning...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rerun Workflow
                </>
              )}
            </Button>
            
            <Button variant="outline" asChild>
              <Link href={`/agent/${agentId}/workflows/${executionDetails.workflowId}`}>
                View Workflow
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>

        {detailed && (
          <div className="mt-8 space-y-6">
            {/* Input Data */}
            <div>
              <h3 className="text-md font-medium mb-2">Input Data</h3>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-md overflow-auto max-h-60">
                <pre className="text-sm whitespace-pre-wrap">
                  {JSON.stringify(executionDetails.inputData || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Output Data */}
            <div>
              <h3 className="text-md font-medium mb-2">Output Data</h3>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-md overflow-auto max-h-60">
                <pre className="text-sm whitespace-pre-wrap">
                  {JSON.stringify(executionDetails.outputData || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
