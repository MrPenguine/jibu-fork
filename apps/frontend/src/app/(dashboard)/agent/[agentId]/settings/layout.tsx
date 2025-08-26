"use client";

import React, { ReactNode } from "react";
import { useParams, redirect } from "next/navigation";
import AgentSettingsSidebar from "@libs/shadcn-ui/components/agent/AgentSettingsSidebar";

export default function AgentSettingsLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const agentId = params?.agentId as string;

  if (!agentId) {
    // As a safeguard, if agentId is missing we push to workspace.
    redirect("/workspace");
  }

  return (
    <div className="flex h-screen w-full bg-gray-950 text-gray-100">
      <div className="fixed left-16 top-0 h-screen border-r border-gray-800">
        <AgentSettingsSidebar agentId={agentId} />
      </div>
      <div className="flex-1 ml-[20rem] pl-0">
        {/* Page content */}
        {children}
      </div>
    </div>
  );
}
