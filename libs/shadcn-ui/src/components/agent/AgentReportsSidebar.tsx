"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { SidebarMenu, SidebarMenuItem } from "../ui/sidebar";
import { FileCheck, BarChart } from "lucide-react";

function ReportsItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactElement<{ className?: string }>;
  label: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <SidebarMenuItem>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          isActive
            ? "bg-gray-800 text-white"
            : "text-gray-300 hover:bg-gray-800 hover:text-white"
        )}
      >
        {React.cloneElement(icon, { className: cn("h-4 w-4") })}
        <span>{label}</span>
      </Link>
    </SidebarMenuItem>
  );
}

export default function AgentReportsSidebar({ agentId }: { agentId: string }) {
  return (
    <aside className="h-full w-64 bg-gray-900 text-white border-r border-gray-800">
      <div className="h-14 px-4 flex items-center">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <FileCheck className="h-4 w-4" />
          <span>Transcripts & Evals</span>
        </div>
      </div>
      <div className="px-2">
        <SidebarMenu className="gap-1">
          <ReportsItem href={`/agent/${agentId}/transcripts`} icon={<FileCheck />} label="Transcripts" />
          <ReportsItem href={`/agent/${agentId}/evaluations`} icon={<BarChart />} label="Evaluations" />
        </SidebarMenu>
      </div>
    </aside>
  );
}
