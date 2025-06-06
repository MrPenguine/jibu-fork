"use client";

import React, { useState, useEffect } from 'react';
import { Workflow as WorkflowIcon, ArrowUpDown, Play } from 'lucide-react';
import { agentApiClient } from '../../../../../apps/frontend/src/utils/AgentApi';

interface WorkflowsListProps {
  agentId: string;
  searchQuery: string;
  onSelectWorkflow: (workflowId: string) => void;
}

// Import and rename the Workflow type from the AgentApi for clarity
import { Workflow as WorkflowData } from '../../../../../apps/frontend/src/utils/AgentApi';

// Alias for backward compatibility
type WorkflowType = WorkflowData;

// Sample workflow data for initial display
const sampleWorkflows: WorkflowType[] = [
  {
    id: 'wf1',
    name: 'Main Customer Service',
    description: 'Master workflow for customer service',
    trigger: 'Start',
    status: 'In progress',
    assignee: '',
    updatedAt: '19 mins ago',
    workflowType: 'MASTER'
  },
  {
    id: 'wf2',
    name: 'Orders & Purchases',
    description: 'Handle order and purchase inquiries',
    trigger: 'Orders and Purchases',
    status: 'None',
    assignee: '',
    updatedAt: '2 hours ago',
    workflowType: 'SECONDARY',
    masterAgentId: 'wf1'
  },
  {
    id: 'wf3',
    name: 'Returns & Exchanges',
    description: 'Process return and exchange requests',
    trigger: 'Returns and Exchange',
    status: 'None',
    assignee: '',
    updatedAt: '2 hours ago',
    workflowType: 'SECONDARY',
    masterAgentId: 'wf1'
  },
  {
    id: 'wf4',
    name: 'Shop Products',
    description: 'Product catalog and information',
    trigger: 'Shop Products',
    status: 'None',
    assignee: '',
    updatedAt: '2 hours ago',
    workflowType: 'SECONDARY',
    masterAgentId: 'wf1'
  },
  {
    id: 'wf5',
    name: 'Tech Support',
    description: 'Master workflow for tech support',
    trigger: 'Start',
    status: 'None',
    assignee: '',
    updatedAt: '5 hours ago',
    workflowType: 'MASTER'
  }
];

export function WorkflowsList({ agentId, searchQuery, onSelectWorkflow }: WorkflowsListProps) {
  const [workflows, setWorkflows] = useState<WorkflowType[]>(sampleWorkflows);
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');

  // Filter workflows based on search query
  const filteredWorkflows = workflows.filter(workflow => {
    // Apply search filter
    return workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workflow.trigger?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (workflow.description && workflow.description.toLowerCase().includes(searchQuery.toLowerCase()));
  });
  
  // Separate master and secondary workflows
  const masterWorkflows = filteredWorkflows.filter(workflow => workflow.workflowType === 'MASTER');
  const secondaryWorkflows = filteredWorkflows.filter(workflow => workflow.workflowType === 'SECONDARY');

  useEffect(() => {
    // Fetch workflows from the API when the component mounts or agentId changes
    const fetchWorkflows = async () => {
      setIsLoading(true);
      try {
        // Use the real API to fetch workflows
        const workflows = await agentApiClient.getAgentWorkflows(agentId);
        
        // Format the workflow data to match our component needs
        const formattedWorkflows = workflows.map(workflow => ({
          ...workflow,
          // Ensure we use data from the DB including descriptions
          name: workflow.name,
          description: workflow.description,
          trigger: workflow.trigger || 'Start',
          status: workflow.status || 'None',
          assignee: workflow.assignee || '',
          updatedAt: new Date(workflow.updatedAt).toLocaleString() || 'Just now',
          nodes: workflow.nodes || [],
          edges: workflow.edges || []
        }));
        
        console.log('Fetched workflows from DB:', formattedWorkflows);
        setWorkflows(formattedWorkflows);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching workflows:', error);
        // Use sample data as fallback if API request fails
        setWorkflows(sampleWorkflows);
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
          <WorkflowIcon className="h-3 w-3 text-blue-600" />
        </div>
        <span>{trigger}</span>
      </div>
    );
  };

  const getStatusClassName = (status: string) => {
    return status === 'Active' || status === 'In progress'
      ? 'px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800'
      : 'px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800';
  };

  // Open the create workflow modal
  const openCreateModal = () => {
    // Generate a default name for the new workflow based on existing secondary workflows
    const secondaryCount = workflows.filter(w => w.workflowType === 'SECONDARY').length;
    setNewWorkflowName(`Secondary Workflow ${secondaryCount + 1}`);
    setNewWorkflowDescription('');
    setShowCreateModal(true);
  };

  // Handle creation of a new secondary workflow
  const handleCreateSecondaryWorkflow = async () => {
    try {
      // Find the master workflow
      const masterWorkflow = workflows.find(w => w.workflowType === 'MASTER');
      
      if (!masterWorkflow) {
        alert('No master workflow found. Cannot create a secondary workflow.');
        return;
      }
      
      if (!newWorkflowName.trim()) {
        alert('Please provide a name for the workflow.');
        return;
      }

      // Close modal and show loading state
      setShowCreateModal(false);
      setIsLoading(true);
      
      // Create a new secondary workflow via the API with the updated API signature
      // Explicitly set nodes and edges to empty arrays for a clean workflow
      await agentApiClient.createSecondaryWorkflow(
        masterWorkflow.id,
        {
          name: newWorkflowName,
          description: newWorkflowDescription || `Secondary workflow linked to ${masterWorkflow.name}`,
          nodes: JSON.stringify([]), // Explicitly set empty array for nodes, stringified to match backend expectation
          edges: JSON.stringify([])  // Explicitly set empty array for edges, stringified to match backend expectation
        }
      );
      
      // Refresh the workflows list
      const updatedWorkflows = await agentApiClient.getAgentWorkflows(agentId);
      
      // Format the workflow data to match our component needs
      const formattedWorkflows = updatedWorkflows.map(workflow => ({
        ...workflow,
        trigger: workflow.trigger || 'Start',
        status: workflow.status || 'None',
        assignee: workflow.assignee || '',
        updatedAt: new Date(workflow.updatedAt).toLocaleString() || 'Just now'
      }));
      
      setWorkflows(formattedWorkflows);
      setIsLoading(false);
    } catch (error) {
      console.error('Error creating secondary workflow:', error);
      alert('Failed to create secondary workflow. Please try again.');
      setIsLoading(false);
    }
  };
  
  if (isLoading) {
    return <div className="p-8 text-center">Loading workflows...</div>;
  }

  if (filteredWorkflows.length === 0) {
    return (
      <div className="p-8 text-center flex flex-col items-center">
        <p className="mb-4">No workflows found matching your criteria.</p>
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          onClick={handleCreateSecondaryWorkflow}
        >
          Create Secondary Workflow
        </button>
      </div>
    );
  }

  // Render a workflow table with the given list of workflows
  const renderWorkflowTable = (workflows: WorkflowType[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-50 text-xs uppercase font-medium text-gray-500">
          <tr>
            <th className="px-8 py-3 w-12 rounded-tl-md">
              <input 
                type="checkbox" 
                className="h-4 w-4 rounded-sm"
                checked={workflows.length > 0 && workflows.every(w => selectedWorkflows.includes(w.id))}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedWorkflows(prev => [...prev, ...workflows.map(w => w.id).filter(id => !prev.includes(id))]);
                  } else {
                    setSelectedWorkflows(prev => prev.filter(id => !workflows.map(w => w.id).includes(id)));
                  }
                }}
              />
            </th>
            <th className="px-6 py-3">
              <div className="flex items-center">
                Name
              </div>
            </th>
            <th className="px-6 py-3">Description</th>
            <th className="px-6 py-3">Triggers</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3 rounded-tr-md">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {workflows.map((workflow) => (
            <tr 
              key={workflow.id}
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelectWorkflow(workflow.id)}
            >
              <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  className="h-4 w-4 rounded-sm"
                  checked={selectedWorkflows.includes(workflow.id)}
                  onChange={(e) => handleCheckboxChange(workflow.id, e)}
                />
              </td>
              <td className="px-6 py-3 font-medium">{workflow.name}</td>
              <td className="px-6 py-3 text-gray-500 text-sm">{workflow.description || '—'}</td>
              <td className="px-6 py-3">{renderTriggerCell(workflow.trigger || 'Start')}</td>
              <td className="px-6 py-3">
                <span className={getStatusClassName(workflow.status || 'None')}>
                  {workflow.status || 'None'}
                </span>
              </td>
              <td className="px-6 py-3 text-sm">{workflow.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="relative space-y-6">
      {/* Create Secondary Workflow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Create Secondary Workflow</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input 
                type="text" 
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                placeholder="Enter workflow name"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea 
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                value={newWorkflowDescription}
                onChange={(e) => setNewWorkflowDescription(e.target.value)}
                placeholder="Enter workflow description"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button 
                className="px-4 py-2 border rounded hover:bg-gray-50"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleCreateSecondaryWorkflow}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content container */}
      <div className="space-y-8">
        {/* Master Workflow Section */}
        <div>
          <h2 className="text-xl font-medium mb-4 px-6">Master Workflow</h2>
          <div className="bg-white rounded-lg">
            {isLoading ? (
              <div className="py-8 text-center">
                <p>Loading workflows...</p>
              </div>
            ) : masterWorkflows.length === 0 ? (
              <div className="py-8 text-center">
                <p>No master workflow found.</p>
              </div>
            ) : (
              renderWorkflowTable(masterWorkflows)
            )}
          </div>
        </div>

        {/* Secondary Workflows Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium px-6">Secondary Workflows</h2>
            <button 
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              onClick={openCreateModal}
            >
              Create Secondary Workflow
            </button>
          </div>
          
          <div className="bg-white rounded-lg">
            {isLoading ? (
              <div className="py-8 text-center">
                <p>Loading workflows...</p>
              </div>
            ) : secondaryWorkflows.length === 0 ? (
              <div className="py-8 text-center rounded-lg">
                <p className="mb-2">No secondary workflows found.</p>
                <p className="text-sm text-gray-600 mb-4">Create secondary workflows to add more functionality to your agent.</p>
              </div>
            ) : (
              renderWorkflowTable(secondaryWorkflows)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
