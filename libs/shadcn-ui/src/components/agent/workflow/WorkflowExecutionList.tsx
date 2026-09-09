import React, { useEffect } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { Clock, CheckCircle, XCircle, AlertCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Spinner } from '../../../components/ui/spinner';
import { useWorkflowExecutions, ExecutionFilters } from '../../../hooks/useWorkflowExecutions';

interface WorkflowExecutionListProps {
  agentId: string;
  filters?: ExecutionFilters;
}

export function WorkflowExecutionList({ agentId, filters = {} }: WorkflowExecutionListProps) {
  const { executions, loading, error, fetchExecutions, rerunExecution } = useWorkflowExecutions();

  useEffect(() => {
    fetchExecutions(filters);
  }, [fetchExecutions, filters]);

  const handleRerun = async (executionId: string) => {
    try {
      await rerunExecution(executionId);
      // Refresh the list after rerunning
      fetchExecutions(filters);
    } catch (err) {
      console.error('Failed to rerun execution:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-brand-navy" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'failed':
        return <Badge variant="danger">Failed</Badge>;
      case 'running':
        return <Badge variant="info">Running</Badge>;
      default:
        return <Badge variant="neutral">Pending</Badge>;
    }
  };

  if (loading && executions.length === 0) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner className="text-primary h-8 w-8" />
        <span className="ml-2">Loading executions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-destructive">
        <p>Failed to load executions. Please try again.</p>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed rounded-md">
        <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-2" />
        <h3 className="text-lg font-medium">No executions found</h3>
        <p className="text-muted-foreground">No workflow executions match your current filters.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Workflow</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {executions.map((execution) => (
          <TableRow key={execution.id}>
            <TableCell>
              <div className="flex items-center">
                {getStatusIcon(execution.status)}
                <span className="ml-2">{getStatusBadge(execution.status)}</span>
              </div>
            </TableCell>
            <TableCell>
              <div>
                <Link 
                  href={`/agent/${agentId}/workflows/executions/${execution.id}`}
                  className="font-medium hover:underline"
                >
                  {execution.workflowName}
                </Link>
                <div className="text-xs text-muted-foreground">ID: {execution.id.substring(0, 8)}...</div>
              </div>
            </TableCell>
            <TableCell>
              {format(new Date(execution.startedAt), 'MMM d, yyyy HH:mm:ss')}
            </TableCell>
            <TableCell>
              {execution.duration ? `${(execution.duration / 1000).toFixed(2)}s` : '-'}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRerun(execution.id)}
                  disabled={execution.status === 'running'}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="sr-only">Rerun</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <Link href={`/agent/${agentId}/workflows/executions/${execution.id}`}>
                    <PlayCircle className="h-4 w-4" />
                    <span className="sr-only">View</span>
                  </Link>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
