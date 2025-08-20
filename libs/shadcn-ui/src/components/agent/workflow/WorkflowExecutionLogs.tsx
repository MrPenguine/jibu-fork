import React, { useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import { AlertCircle, Info, AlertTriangle, Search, Download } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useWorkflowExecutions, ExecutionLog } from '../../../hooks/useWorkflowExecutions';

interface WorkflowExecutionLogsProps {
  agentId: string;
  executionId: string;
}

export function WorkflowExecutionLogs({ agentId, executionId }: WorkflowExecutionLogsProps) {
  const { loading, error, fetchExecutionDetails } = useWorkflowExecutions();
  const [executionDetails, setExecutionDetails] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevel, setLogLevel] = useState('all');
  const [nodeFilter, setNodeFilter] = useState('all');
  const logsEndRef = useRef<HTMLDivElement>(null);

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

  // Scroll to bottom when logs change
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [executionDetails?.logs]);

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLogClass = (level: string) => {
    switch (level) {
      case 'info':
        return 'border-blue-200 bg-blue-50';
      case 'warn':
        return 'border-yellow-200 bg-yellow-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const downloadLogs = () => {
    if (!executionDetails?.logs) return;

    const logs = filteredLogs.map((log: ExecutionLog) => {
      return {
        timestamp: log.timestamp,
        level: log.level,
        nodeId: log.nodeId || 'system',
        message: log.message,
        data: log.data
      };
    });

    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-execution-${executionId.substring(0, 8)}-logs.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get unique node IDs for filtering
  const nodeIds = executionDetails?.logs
    ? Array.from(new Set(executionDetails.logs.map((log: ExecutionLog) => log.nodeId || 'system')))
    : [];

  // Filter logs based on search term, log level, and node filter
  const filteredLogs = executionDetails?.logs
    ? executionDetails.logs.filter((log: ExecutionLog) => {
        const matchesSearch = searchTerm
          ? log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
            JSON.stringify(log.data).toLowerCase().includes(searchTerm.toLowerCase())
          : true;
        
        const matchesLevel = logLevel === 'all' ? true : log.level === logLevel;
        
        const matchesNode = nodeFilter === 'all'
          ? true
          : nodeFilter === 'system'
          ? !log.nodeId
          : log.nodeId === nodeFilter;
        
        return matchesSearch && matchesLevel && matchesNode;
      })
    : [];

  if (loading && !executionDetails) {
    return (
      <div className="flex justify-center items-center p-8">
        <Spinner className="text-blue-500 h-8 w-8" />
        <span className="ml-2">Loading execution logs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
        <p>Failed to load execution logs. Please try again.</p>
      </div>
    );
  }

  if (!executionDetails || !executionDetails.logs || executionDetails.logs.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed rounded-md">
        <AlertCircle className="h-10 w-10 text-gray-400 mx-auto mb-2" />
        <h3 className="text-lg font-medium">No logs available</h3>
        <p className="text-gray-500">This execution does not have any logs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={logLevel} onValueChange={setLogLevel}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Log Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={nodeFilter} onValueChange={setNodeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Node" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Nodes</SelectItem>
              <SelectItem value="system">System</SelectItem>
              {nodeIds.filter(id => id).map((nodeId) => (
                <SelectItem key={nodeId} value={nodeId}>
                  {nodeId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={downloadLogs}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-md overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 p-2 text-sm font-medium">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-2">Timestamp</div>
            <div className="col-span-1">Level</div>
            <div className="col-span-2">Node</div>
            <div className="col-span-7">Message</div>
          </div>
        </div>
        
        <div className="overflow-auto max-h-[500px]">
          {filteredLogs.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No logs match your current filters
            </div>
          ) : (
            filteredLogs.map((log: ExecutionLog, index: number) => (
              <div
                key={`${log.timestamp}-${index}`}
                className={`border-b border-gray-200 p-2 text-sm ${getLogClass(log.level)}`}
              >
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-2 text-gray-600">
                    {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                  </div>
                  <div className="col-span-1 flex items-center">
                    {getLogIcon(log.level)}
                  </div>
                  <div className="col-span-2 text-gray-600 truncate">
                    {log.nodeId || 'system'}
                  </div>
                  <div className="col-span-7">
                    <div>{log.message}</div>
                    {log.data && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-gray-500">
                          View details
                        </summary>
                        <pre className="mt-1 p-2 bg-white border border-gray-200 rounded text-xs overflow-auto max-h-40">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
      
      <div className="text-sm text-gray-500 text-right">
        Showing {filteredLogs.length} of {executionDetails.logs.length} logs
      </div>
    </div>
  );
}
