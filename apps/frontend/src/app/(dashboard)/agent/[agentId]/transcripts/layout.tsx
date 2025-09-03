"use client";

import React, { ReactNode } from "react";
import { useParams, redirect } from "next/navigation";
import AgentReportsSidebar from "@libs/shadcn-ui/components/agent/AgentReportsSidebar";

export default function AgentTranscriptsLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const agentId = params?.agentId as string;

  if (!agentId) {
    redirect("/workspace");
  }

  return (
    <div className="flex min-h-screen w-full bg-white text-gray-900">
      {/* Fixed Reports sidebar positioned immediately after the 4rem agent rail */}
      <div
        className="fixed top-0 bottom-0 z-40"
        style={{
          left: "var(--sidebar-width)",
          width: "16rem",
        }}
      >
        <AgentReportsSidebar agentId={agentId} />
      </div>
      {/* Content starts after the agent rail (4rem) + Reports sidebar (16rem) */}
      <div
        className="flex-1 min-h-screen bg-white overflow-y-auto"
        style={{ marginLeft: "calc(var(--sidebar-width) + 16rem)" }}
      >
        {children}
      </div>
    </div>
  );
}
