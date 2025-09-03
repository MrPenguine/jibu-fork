"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { SidebarMenu, SidebarMenuItem } from "../ui/sidebar";
import {
  GitBranch,
  Bot,
  Wrench,
  Sparkles,
  MessageSquare,
  Boxes,
  Calendar,
  Braces,
  Target,
  Shapes,
} from "lucide-react";

function CmsItem({
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
          isActive ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
        )}
      >
        {React.cloneElement(icon, { className: cn("h-4 w-4") })}
        <span>{label}</span>
      </Link>
    </SidebarMenuItem>
  );
}

export default function AgentCmsSidebar({ agentId }: { agentId: string }) {
  return (
    <aside className="h-full w-64 bg-gray-900 text-white border-r border-gray-800">
      <div className="h-14 px-4 flex items-center">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <GitBranch className="h-4 w-4" />
          <span>Content</span>
        </div>
      </div>
      <div className="px-2">
        <SidebarMenu className="gap-1">
          <CmsItem href={`/agent/${agentId}/cms/workflows`} icon={<GitBranch />} label="Workflows" />
          <CmsItem href={`/agent/${agentId}/cms/agents`} icon={<Bot />} label="Agents" />
          <CmsItem href={`/agent/${agentId}/cms/tools`} icon={<Wrench />} label="Tools" />
          <CmsItem href={`/agent/${agentId}/cms/prompts`} icon={<Sparkles />} label="Prompts" />
          <CmsItem href={`/agent/${agentId}/cms/messages`} icon={<MessageSquare />} label="Messages" />
          <CmsItem href={`/agent/${agentId}/cms/components`} icon={<Boxes />} label="Components" />
          <CmsItem href={`/agent/${agentId}/cms/events`} icon={<Calendar />} label="Events" />
          <CmsItem href={`/agent/${agentId}/cms/variables`} icon={<Braces />} label="Variables" />
          <CmsItem href={`/agent/${agentId}/cms/intents`} icon={<Target />} label="Intents" />
          <CmsItem href={`/agent/${agentId}/cms/entities`} icon={<Shapes />} label="Entities" />
        </SidebarMenu>
      </div>
    </aside>
  );
}
