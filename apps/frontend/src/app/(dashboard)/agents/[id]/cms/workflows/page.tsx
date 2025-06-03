"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Input } from '@libs/shadcn-ui/components/ui/input';
import { Search, Plus } from 'lucide-react';
import { WorkflowsList } from '@libs/shadcn-ui/components/agent';

export default function WorkflowsPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreateWorkflow = () => {
    // For now, just route to a placeholder new workflow page
    router.push(`/agents/${agentId}/cms/workflows/new`);
  };

  return (
    <div className="p-6 bg-gray-50 h-full">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Workflows</h1>
        <div className="flex gap-2 items-center">
          <div className="relative w-60">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search workflows"
              className="pl-8 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            variant="default" 
            onClick={handleCreateWorkflow}
          >
            <Plus className="h-4 w-4 mr-1" />
            New workflow
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <WorkflowsList 
          agentId={agentId}
          searchQuery={searchQuery}
          onSelectWorkflow={(workflowId) => {
            router.push(`/agents/${agentId}/cms/workflows/${workflowId}`);
          }}
        />
      </div>
    </div>
  );
}
