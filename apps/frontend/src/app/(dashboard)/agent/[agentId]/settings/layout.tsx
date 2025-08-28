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
    <div className="flex min-h-screen w-full bg-white text-gray-900">
      {/* Fixed Settings sidebar positioned immediately after the 4rem agent rail */}
      <div
        className="fixed top-0 bottom-0 z-40"
        style={{
          left: "var(--sidebar-width)",
          width: "16rem",
        }}
      >
        <AgentSettingsSidebar agentId={agentId} />
      </div>
      {/* Content starts after the agent rail (4rem) + Settings sidebar (16rem) */}
      <div
        className="flex-1 pl-0 min-h-screen bg-white overflow-y-auto"
        style={{ marginLeft: "calc(var(--sidebar-width) + 16rem)" }}
      >
        {/* Page content */}
        {children}
      </div>
    </div>
  );
}
