"use client";

import React, { ReactNode, useEffect, useState } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { agentApiClient } from '../../../../utils/AgentApi';
import { workflowApi } from '../../../../utils/workflowApi';
import { Skeleton } from '@libs/shadcn-ui/components/ui/skeleton';
import { AgentNavSidebar } from '@libs/shadcn-ui/components/agent/AgentNavSidebar';
import { SidebarProvider, SidebarInset } from '@libs/shadcn-ui/components/ui/sidebar';

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
    <div className="relative flex min-h-screen w-full bg-white">
      <SidebarProvider
        style={{
          // Ensure all sidebar internals and any consumers use a compact 4rem width
          // This matches AgentNavSidebar and the spacer below
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore - CSS var typing
          "--sidebar-width": "4rem",
          // Keep icon rail var consistent (not strictly needed here, but safe)
          // @ts-ignore
          "--sidebar-width-icon": "3rem",
        } as React.CSSProperties}
      >
        <div className="fixed left-0 top-0 bottom-0 z-50">
          <AgentNavSidebar agentId={agentId} masterWorkflowId={masterWorkflowId} />
        </div>
        {/* Spacer to account for fixed sidebar width and avoid background gaps */}
        <div
          className="shrink-0"
          style={{
            // Use the same CSS variable so it always matches the sidebar width
            // Fallback width is still covered by the provider override
            width: "var(--sidebar-width)",
          }}
        />
        <main className="flex-1 overflow-y-auto min-h-screen bg-white text-gray-900">
          {children}
        </main>
      </SidebarProvider>
    </div>
  );
}
