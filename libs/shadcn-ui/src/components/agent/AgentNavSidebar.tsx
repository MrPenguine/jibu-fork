"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "../../lib/utils"
import { Separator } from "../ui/separator"
import {
  MessageSquare,
  Settings,
  ArrowLeft,
  SlidersHorizontal,
  Database,
  FileCheck,
} from "lucide-react"

export interface AgentNavSidebarProps {
  agentId: string;
  masterWorkflowId?: string | null;
  className?: string;
}

export function AgentNavSidebar({
  className,
  agentId,
  masterWorkflowId,
}: AgentNavSidebarProps) {
  const [workspaceId, setWorkspaceId] = React.useState<string | null>(null);
  const pathname = usePathname();

  React.useEffect(() => {
    const storedWorkspaceId = localStorage.getItem('currentWorkspaceId');
    if (storedWorkspaceId) {
      setWorkspaceId(storedWorkspaceId);
    }
  }, []);
  
  const backHref = workspaceId ? `/workspace/${workspaceId}/agents` : '/workspace';
  
  const menuItems = [
    { href: `/agent/${agentId}/config`, label: "Configure", icon: <SlidersHorizontal className="h-4 w-4" /> },
    { href: `/agent/${agentId}/playground`, label: "Playground", icon: <MessageSquare className="h-4 w-4" /> },
    { href: `/agent/${agentId}/knowledge-base`, label: "Knowledge base", icon: <Database className="h-4 w-4" /> },
    { href: `/agent/${agentId}/transcripts`, label: "Transcripts", icon: <FileCheck className="h-4 w-4" /> },
  ];

  return (
    <div className={cn("w-56 h-screen bg-[#222E50] text-white flex flex-col border-r border-[#1a243f] flex-shrink-0 shadow-lg select-none", className)}>
      {/* Header logo */}
      <div className="h-14 flex items-center px-5 border-b border-gray-800/60">
        <img
          src="/logo-light.svg"
          alt="Jibu.ai Logo"
          className="w-28 h-auto"
        />
      </div>
      
      {/* Navigation links */}
      <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        <Link 
          href={backHref}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-[#2d3a5f] hover:text-white transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Agents</span>
        </Link>
        
        <div className="my-3">
          <Separator className="bg-gray-700/60" />
        </div>

        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                isActive 
                  ? "bg-[#009959] text-white font-medium shadow-sm" 
                  : "text-gray-305 hover:bg-[#2d3a5f] hover:text-white"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer settings */}
      <div className="p-3 border-t border-gray-800/60">
        <Link
          href={`/agent/${agentId}/settings`}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
            pathname?.includes('/settings')
              ? "bg-[#009959] text-white font-medium"
              : "text-gray-305 hover:bg-[#2d3a5f] hover:text-white"
          )}
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </Link>
      </div>
    </div>
  );
}

export default AgentNavSidebar;
