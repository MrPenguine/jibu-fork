"use client";

import React, { useState, useEffect } from 'react';
import { Workflow, ArrowUpDown, Play } from 'lucide-react';
import { agentApiClient } from '../../../../../apps/frontend/src/utils/AgentApi';

interface WorkflowsListProps {
  agentId: string;
  searchQuery: string;
  onSelectWorkflow: (workflowId: string) => void;
}

type WorkflowType = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  status: string;
  assignee: string;
  updatedAt: string;
};

// Sample workflow data for initial display
const sampleWorkflows: WorkflowType[] = [
  {
    id: 'wf1',
    name: 'Home',
    description: '',
    trigger: 'Start',
    status: 'In progress',
    assignee: '',
    updatedAt: '19 mins ago'
  },
  {
    id: 'wf2',
    name: 'Orders & Purchases',
    description: '',
    trigger: 'Orders and Purchases',
    status: 'None',
    assignee: '',
    updatedAt: '2 hours ago'
  },
  {
    id: 'wf3',
    name: 'Returns & Exchanges',
    description: '',
    trigger: 'Returns and Exchange',
    status: 'None',
    assignee: '',
    updatedAt: '2 hours ago'
  },
  {
    id: 'wf4',
    name: 'Shop Products',
    description: '',
    trigger: 'Shop Products',
    status: 'None',
    assignee: '',
    updatedAt: '2 hours ago'
  }
];

export function WorkflowsList({ agentId, searchQuery, onSelectWorkflow }: WorkflowsListProps) {
  const [workflows, setWorkflows] = useState<WorkflowType[]>(sampleWorkflows);
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filter workflows based on search query
  const filteredWorkflows = workflows.filter(workflow => 
    workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    workflow.trigger.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    // In a real implementation, we would fetch workflows from the API here
    // For now, we'll just use the sample data
    const fetchWorkflows = async () => {
      setIsLoading(true);
      try {
        // In a real implementation, we would use something like:
        // const response = await agentApiClient.getAgentWorkflows(agentId);
        // setWorkflows(response.data);
        
        // For now, just simulate a delay with the sample data
        setTimeout(() => {
          setWorkflows(sampleWorkflows);
          setIsLoading(false);
        }, 500);
      } catch (error) {
        console.error('Error fetching workflows:', error);
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, [agentId]);

  const handleCheckAllChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    if (checked) {
      setSelectedWorkflows(filteredWorkflows.map(w => w.id));
    } else {
      setSelectedWorkflows([]);
    }
  };

  const handleCheckboxChange = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    if (checked) {
      setSelectedWorkflows([...selectedWorkflows, id]);
    } else {
      setSelectedWorkflows(selectedWorkflows.filter(workflowId => workflowId !== id));
    }
  };

  const renderTriggerCell = (trigger: string) => {
    if (trigger === 'Start') {
      return (
        <div className="flex items-center">
          <div className="mr-2 bg-blue-100 p-1 rounded">
            <Play className="h-3 w-3 text-blue-600" />
          </div>
          <span>{trigger}</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center">
        <div className="mr-2 bg-blue-100 p-1 rounded">
          <Workflow className="h-3 w-3 text-blue-600" />
        </div>
        <span>{trigger}</span>
      </div>
    );
  };

  const getStatusClassName = (status: string) => {
    return status === 'In progress' 
      ? "px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800" 
      : "px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading workflows...</div>;
  }

  if (filteredWorkflows.length === 0) {
    return <div className="p-8 text-center">No workflows found. Create a new workflow to get started.</div>;
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-50 text-gray-700 text-sm font-medium">
          <tr>
            <th className="p-4 w-12">
              <input 
                type="checkbox" 
                className="h-4 w-4"
                checked={selectedWorkflows.length === filteredWorkflows.length && filteredWorkflows.length > 0}
                onChange={handleCheckAllChange}
              />
            </th>
            <th className="p-4">
              <div className="flex items-center cursor-pointer">
                Name <ArrowUpDown className="ml-2 h-3 w-3" />
              </div>
            </th>
            <th className="p-4">Description</th>
            <th className="p-4">Triggers</th>
            <th className="p-4">Status</th>
            <th className="p-4">Assignee</th>
            <th className="p-4">Updated</th>
          </tr>
        </thead>
        <tbody>
          {filteredWorkflows.map((workflow) => (
            <tr 
              key={workflow.id}
              className="border-b cursor-pointer hover:bg-gray-50"
              onClick={() => onSelectWorkflow(workflow.id)}
            >
              <td className="p-4" onClick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  className="h-4 w-4"
                  checked={selectedWorkflows.includes(workflow.id)}
                  onChange={(e) => handleCheckboxChange(workflow.id, e)}
                />
              </td>
              <td className="p-4 font-medium">{workflow.name}</td>
              <td className="p-4 text-gray-500">{workflow.description || '—'}</td>
              <td className="p-4">{renderTriggerCell(workflow.trigger)}</td>
              <td className="p-4">
                <span className={getStatusClassName(workflow.status)}>
                  {workflow.status}
                </span>
              </td>
              <td className="p-4">{workflow.assignee || '—'}</td>
              <td className="p-4">{workflow.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
