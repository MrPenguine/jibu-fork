import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Spinner } from '../../../components/ui/spinner';
import { useWorkflowExecutions, ExecutionNode } from '../../../hooks/useWorkflowExecutions';

interface WorkflowExecutionTimelineProps {
  agentId: string;
  executionId: string;
}

export function WorkflowExecutionTimeline({ agentId, executionId }: WorkflowExecutionTimelineProps) {
  const { loading, error, fetchExecutionDetails, rerunNode } = useWorkflowExecutions();
  const [executionDetails, setExecutionDetails] = useState<any | null>(null);
  const [rerunningNodeId, setRerunningNodeId] = useState<string | null>(null);

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

  const handleRerunNode = async (nodeId: string) => {
    try {
      setRerunningNodeId(nodeId);
      await rerunNode(executionId, nodeId);
      
      // Refresh execution details after rerunning the node
      const details = await fetchExecutionDetails(executionId);
      setExecutionDetails(details);
    } catch (err) {
      console.error('Failed to rerun node:', err);
    } finally {
      setRerunningNodeId(null);
    }
  };

  const getNodeStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNodeStatusClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      case 'running':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  if (loading && !executionDetails) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner className="text-blue-500 h-8 w-8" />
        <span className="ml-2">Loading execution timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
        <p>Failed to load execution timeline. Please try again.</p>
      </div>
    );
  }

  if (!executionDetails || !executionDetails.nodes || executionDetails.nodes.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed rounded-md">
        <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-2" />
        <h3 className="text-lg font-medium">No timeline data available</h3>
        <p className="text-gray-500">This execution does not have any node execution data.</p>
      </div>
    );
  }

  // Sort nodes by start time
  const sortedNodes = [...executionDetails.nodes].sort((a, b) => {
    return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
  });

  return (
    <div className="space-y-6">
      <div className="relative pl-8 space-y-6">
        {/* Vertical timeline line */}
        <div className="absolute left-4 top-5 bottom-5 w-0.5 bg-gray-200"></div>

        {sortedNodes.map((node: ExecutionNode, index: number) => (
          <div key={node.id} className="relative">
            {/* Timeline dot */}
            <div className="absolute -left-4 mt-1.5 p-1 rounded-full bg-white border border-gray-300">
              {getNodeStatusIcon(node.status)}
            </div>

            <Card className={`ml-6 ${getNodeStatusClass(node.status)}`}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">{node.name}</h4>
                    <p className="text-sm text-gray-500">{node.type}</p>
                    
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-gray-400 mr-1" />
                        <span>Started: {format(new Date(node.startedAt), 'MMM d, yyyy HH:mm:ss')}</span>
                      </div>
                      
                      {node.completedAt && (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-gray-400 mr-1" />
                          <span>Completed: {format(new Date(node.completedAt), 'MMM d, yyyy HH:mm:ss')}</span>
                        </div>
                      )}
                      
                      {node.duration !== undefined && (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 text-gray-400 mr-1" />
                          <span>Duration: {(node.duration / 1000).toFixed(2)}s</span>
                        </div>
                      )}
                    </div>

                    {node.error && (
                      <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-700">
                        {node.error}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRerunNode(node.id)}
                      disabled={rerunningNodeId === node.id}
                      className="whitespace-nowrap"
                    >
                      {rerunningNodeId === node.id ? (
                        <>
                          <Spinner className="h-4 w-4 mr-2" />
                          Rerunning...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Rerun Node
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Input/Output Data Collapsible Sections */}
                {(node.inputData || node.outputData) && (
                  <div className="mt-4 space-y-3">
                    {node.inputData && (
                      <details className="group">
                        <summary className="flex items-center cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900">
                          <span className="mr-2">Input Data</span>
                          <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="mt-2 p-2 bg-white border border-gray-200 rounded text-sm overflow-auto max-h-60">
                          <pre className="whitespace-pre-wrap">{JSON.stringify(node.inputData, null, 2)}</pre>
                        </div>
                      </details>
                    )}
                    
                    {node.outputData && (
                      <details className="group">
                        <summary className="flex items-center cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900">
                          <span className="mr-2">Output Data</span>
                          <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="mt-2 p-2 bg-white border border-gray-200 rounded text-sm overflow-auto max-h-60">
                          <pre className="whitespace-pre-wrap">{JSON.stringify(node.outputData, null, 2)}</pre>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
