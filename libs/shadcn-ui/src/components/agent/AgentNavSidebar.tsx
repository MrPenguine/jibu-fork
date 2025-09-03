"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "../../lib/utils"
import {
  Sidebar,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "../ui/sidebar"
import { Separator } from "../ui/separator"
import {
  BarChart,
  BookOpen,
  FileText,
  Info,
  LayoutDashboard,
  MessageSquare,
  Settings,
  CreditCard,
  Database,
  Layers,
  FileCode,
  FileCheck,
} from "lucide-react"

function NavItem({ 
  href, 
  icon, 
  children,
  active,
}: {
  href: string;
  icon: React.ReactElement<{ className?: string }>;
  children: React.ReactNode;
  active?: boolean;
}) {
  const pathname = usePathname();
  const isActive = active !== undefined ? active : pathname === href || pathname?.startsWith(`${href}/`);
  
  return (
    <SidebarMenuItem>
      <div className={cn(
        "w-full flex items-center justify-center group relative px-3 py-2 rounded-md transition-colors",
        isActive ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
      )}>
        <Link href={href} className="w-full flex items-center justify-center" aria-label={String(children)} title={String(children)}>
          {React.cloneElement(icon, {
            className: cn("h-5 w-5", icon.props.className),
          })}
          <span className="pointer-events-none absolute left-12 ml-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
            {children}
          </span>
        </Link>
      </div>
    </SidebarMenuItem>
  );
}

export interface AgentNavSidebarProps extends React.ComponentProps<typeof Sidebar> {
  agentId: string;
  masterWorkflowId?: string | null;
}

export function AgentNavSidebar({
  className,
  agentId,
  masterWorkflowId,
  ...props
}: AgentNavSidebarProps) {
  const canvasHref = masterWorkflowId
    ? `/agent/${agentId}/canvas/${masterWorkflowId}`
    : `/agent/${agentId}/workflows`;
  return (
    <Sidebar
      collapsible="none"
      // Ensure the sidebar uses a compact icon rail width and matches the spacer via CSS var
      style={{
        // Override the provider default (16rem) to a compact 4rem icon rail
        // This controls all w-[--sidebar-width] usages inside the Sidebar
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - CSS var type
        "--sidebar-width": "4rem",
      } as React.CSSProperties}
      className={cn("!border-0 !bg-gray-900 text-white h-screen fixed left-0 top-0 z-50", className)}
      {...props}
    >
      <SidebarHeader className="border-0 flex-col !p-0">
        <div className="w-full flex items-center justify-center h-14 pt-4 pb-1">
          <img
            src="/icon.svg"
            alt="Jibu.ai Logo"
            className="w-8 h-8"
          />
        </div>
      </SidebarHeader>
      
      {/* Replace SidebarContent (which adds a ScrollArea) with a simple container to remove extra scrollbar */}
      <div className="border-0 pt-0">
        <SidebarGroup className="m-0 p-0">
          <SidebarMenu>
            <NavItem href={canvasHref} icon={<LayoutDashboard />}>
              Canvas
            </NavItem>
            <NavItem href={`/agent/${agentId}/cms/workflows`} icon={<FileText />}>
              Content
            </NavItem>
            <NavItem href={`/agent/${agentId}/knowledge-base`} icon={<Database />}>
              Knowledge base
            </NavItem>
            <NavItem href={`/agent/${agentId}/interfaces`} icon={<Layers />}>
              Interfaces
            </NavItem>
            <NavItem href={`/agent/${agentId}/transcripts`} icon={<FileCheck />}>
              Transcripts & Evals
            </NavItem>
            <NavItem href={`/agent/${agentId}/analytics`} icon={<BarChart />}>
              Analytics
            </NavItem>
          </SidebarMenu>
        </SidebarGroup>
      </div>

      <SidebarFooter className="border-0 flex-col gap-2 mt-auto">
        <Separator className="my-2" />
        <NavItem href={`/agent/${agentId}/settings`} icon={<Settings />}>
          Settings
        </NavItem>
        <NavItem href={`/agent/${agentId}/usage`} icon={<CreditCard />}>
          Credit Usage
        </NavItem>
        <NavItem href={`/agent/${agentId}/info`} icon={<Info />}>
          Info
        </NavItem>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AgentNavSidebar;
