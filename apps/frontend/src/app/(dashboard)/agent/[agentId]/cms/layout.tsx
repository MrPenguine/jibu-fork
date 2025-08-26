"use client";

import React, { ReactNode } from "react";
import { useParams, redirect } from "next/navigation";
import AgentCmsSidebar from "@libs/shadcn-ui/components/agent/AgentCmsSidebar";

export default function AgentCmsLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const agentId = params?.agentId as string;

  if (!agentId) {
    redirect("/workspace");
  }

  return (
    <div className="flex h-screen w-full bg-gray-950 text-gray-100">
      <div className="fixed left-16 top-0 h-screen border-r border-gray-800">
        <AgentCmsSidebar agentId={agentId} />
      </div>
      <div className="flex-1 ml-[20rem] pl-0">
        {children}
      </div>
    </div>
  );
}
