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
  ArrowLeft,
  SlidersHorizontal,
} from "lucide-react"

// Canvas (ReactFlow) is deprecated as the primary editor and hidden by default.
// Re-enable the advanced canvas route by setting NEXT_PUBLIC_ENABLE_CANVAS=true.
const CANVAS_ENABLED =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ENABLE_CANVAS === "true";

function NavItem({ 
  href, 
  icon, 
  children,
  active,
  isExpanded,
}: {
  href: string;
  icon: React.ReactElement<{ className?: string }>;
  children: React.ReactNode;
  active?: boolean;
  isExpanded: boolean;
}) {
  const pathname = usePathname();
  const isActive = active !== undefined ? active : pathname === href || pathname?.startsWith(`${href}/`);
  
  return (
    <SidebarMenuItem>
      <div className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
        isActive ? "bg-[#009959] text-white font-medium shadow-sm" : "text-gray-300 hover:bg-[#2d3a5f] hover:text-white"
      )}>
        <Link href={href} className="w-full flex items-center gap-3" aria-label={String(children)}>
          {React.cloneElement(icon, {
            className: cn("h-5 w-5 flex-shrink-0", icon.props.className),
          })}
          <span className={cn(
            "whitespace-nowrap transition-all duration-200 overflow-hidden",
            isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
          )}>
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
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [workspaceId, setWorkspaceId] = React.useState<string | null>(null);
  
  // Extract workspace ID from agent (you may need to fetch this from your agent data)
  React.useEffect(() => {
    // This is a placeholder - you'll need to get the actual workspace ID from your agent data
    // For now, we'll try to extract it from the URL or local storage
    const storedWorkspaceId = localStorage.getItem('currentWorkspaceId');
    if (storedWorkspaceId) {
      setWorkspaceId(storedWorkspaceId);
    }
  }, []);
  
  const canvasHref = masterWorkflowId
    ? `/agent/${agentId}/canvas/${masterWorkflowId}`
    : `/agent/${agentId}/workflows`;
  const backHref = workspaceId ? `/workspace/${workspaceId}/agents` : '/workspace';
  
  return (
    <Sidebar
      collapsible="none"
      style={{
        // Dynamic width based on hover state
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - CSS var type
        "--sidebar-width": isExpanded ? "16rem" : "4rem",
      } as React.CSSProperties}
      className={cn("!border-0 !bg-[#222E50] text-white h-screen fixed left-0 top-0 z-50 transition-all duration-200 shadow-lg", className)}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      {...props}
    >
      <SidebarHeader className="border-0 flex-col !p-0">
        <div className={cn(
          "w-full flex items-center h-14 pt-4 pb-1 px-4 transition-all duration-200",
          isExpanded ? "justify-start" : "justify-center"
        )}>
          <img
            src="/logo-light.svg"
            alt="Jibu.ai Logo"
            className={cn(
              "transition-all duration-200",
              isExpanded ? "w-32 h-auto" : "w-8 h-8"
            )}
          />
        </div>
      </SidebarHeader>
      
      {/* Replace SidebarContent (which adds a ScrollArea) with a simple container to remove extra scrollbar */}
      <div className="border-0 pt-4 px-2">
        <SidebarGroup className="m-0 p-0">
          <SidebarMenu>
            {/* Back button */}
            <NavItem href={backHref} icon={<ArrowLeft />} isExpanded={isExpanded}>
              Back to Agents
            </NavItem>
            <div className="my-2">
              <Separator className="bg-gray-600" />
            </div>
            <NavItem href={`/agent/${agentId}/config`} icon={<SlidersHorizontal />} isExpanded={isExpanded}>
              Configure
            </NavItem>
            <NavItem href={`/agent/${agentId}/cms/workflows`} icon={<FileText />} isExpanded={isExpanded}>
              Content
            </NavItem>
            {CANVAS_ENABLED && (
              <NavItem href={canvasHref} icon={<LayoutDashboard />} isExpanded={isExpanded}>
                Canvas (beta)
              </NavItem>
            )}
            <NavItem href={`/agent/${agentId}/knowledge-base`} icon={<Database />} isExpanded={isExpanded}>
              Knowledge base
            </NavItem>
            <NavItem href={`/agent/${agentId}/interfaces`} icon={<Layers />} isExpanded={isExpanded}>
              Interfaces
            </NavItem>
            <NavItem href={`/agent/${agentId}/transcripts`} icon={<FileCheck />} isExpanded={isExpanded}>
              Transcripts & Evals
            </NavItem>
            <NavItem href={`/agent/${agentId}/analytics`} icon={<BarChart />} isExpanded={isExpanded}>
              Analytics
            </NavItem>
          </SidebarMenu>
        </SidebarGroup>
      </div>

      <SidebarFooter className="border-0 flex-col gap-2 mt-auto px-2 pb-4">
        <Separator className="my-2 bg-gray-600" />
        <NavItem href={`/agent/${agentId}/settings`} icon={<Settings />} isExpanded={isExpanded}>
          Settings
        </NavItem>
        <NavItem href={`/agent/${agentId}/usage`} icon={<CreditCard />} isExpanded={isExpanded}>
          Credit Usage
        </NavItem>
        <NavItem href={`/agent/${agentId}/info`} icon={<Info />} isExpanded={isExpanded}>
          Info
        </NavItem>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AgentNavSidebar;
