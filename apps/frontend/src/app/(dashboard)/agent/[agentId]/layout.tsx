"use client";

import React, { ReactNode, useEffect, useState } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { agentApiClient } from '../../../../utils/AgentApi';
import { workflowApi } from '../../../../utils/workflowApi';
import { Skeleton } from '@libs/shadcn-ui/components/ui/skeleton';
import { AgentNavSidebar } from '@libs/shadcn-ui/components/agent/AgentNavSidebar';
import { FloatingAgentTester } from './FloatingAgentTester';

export default function AgentLayout({ 
  children
}: { 
  children: ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const agentId = params.agentId as string;
  const [agent, setAgent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [masterWorkflowId, setMasterWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setIsLoading(true);
        const [agentData, workflowsData] = await Promise.all([
          agentApiClient.getAgentDefinition(agentId),
          workflowApi.getWorkflowsByAssistant(agentId),
        ]);

        setAgent(agentData);

        const workflows = (workflowsData as any[]) || [];
        const masterWorkflow = workflows.find(w => w.isPrimary || w.workflowType === 'MASTER');
        if (masterWorkflow) {
          setMasterWorkflowId(masterWorkflow.id);
        }
      } catch (error) {
        console.error('Failed to fetch agent details or workflows:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (agentId) {
      fetchDetails();
    }
  }, [agentId]);

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden relative">
      <AgentNavSidebar agentId={agentId} masterWorkflowId={masterWorkflowId} />
      <main className="flex-1 overflow-y-auto h-screen bg-white text-gray-900">
        {children}
      </main>
      <FloatingAgentTester />
    </div>
  );
}
