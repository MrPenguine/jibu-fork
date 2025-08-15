"use client";

import React, { ReactNode, useEffect, useState } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { agentApiClient } from '../../../../utils/AgentApi';
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

  useEffect(() => {
    const fetchAgentDetails = async () => {
      try {
        setIsLoading(true);
        const agentData = await agentApiClient.getAgentDefinition(agentId);
        setAgent(agentData);
      } catch (error) {
        console.error("Failed to fetch agent details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (agentId) {
      fetchAgentDetails();
    }
  }, [agentId]);

  return (
    <div className="relative flex min-h-screen w-full">
      <SidebarProvider>
        <div className="fixed left-0 top-0 bottom-0 z-50">
          <AgentNavSidebar agentId={agentId} />
        </div>
        <div className="flex-1 pl-16 w-full">
          <main className="w-full h-screen">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}
