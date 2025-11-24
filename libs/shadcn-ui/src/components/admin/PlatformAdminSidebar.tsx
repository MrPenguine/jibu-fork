"use client"

import * as React from "react"
import { useSidebar } from "@libs/shadcn-ui/components/ui/sidebar"
import { cn } from "@libs/shadcn-ui/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@libs/shadcn-ui/components/ui/sidebar"
import { NavUser } from "@libs/shadcn-ui/components/nav/nav-user"
import { Separator } from "@libs/shadcn-ui/components/ui/separator"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Shield,
  Key,
  Users,
  Building2,
  Activity,
  Settings,
  LayoutDashboard,
  ArrowLeft,
  DollarSign,
  BarChart3,
  FileText,
} from "lucide-react"

function NavItem({ 
  href, 
  icon, 
  children,
  badge,
}: {
  href: string;
  icon: React.ReactElement<{ className?: string }>;
  children: React.ReactNode;
  badge?: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(`${href}/`);
  
  return (
    <SidebarMenuItem>
      <div className={cn(
        "w-full flex items-center gap-2 text-sm px-3 py-2 rounded-md transition-colors",
        isActive 
          ? "bg-violet-100 text-violet-700 font-medium" 
          : "text-gray-700 hover:bg-gray-100 hover:text-violet-600"
      )}>
        <Link href={href} className="w-full flex items-center gap-2">
          {React.cloneElement(icon, {
            className: cn("h-4 w-4", icon.props.className),
          })}
          <span className="flex-1">{children}</span>
          {badge && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-violet-600 text-white">
              {badge}
            </span>
          )}
        </Link>
      </div>
    </SidebarMenuItem>
  );
}

export function PlatformAdminSidebar({
  className,
  userInfo,
  onLogout,
  ...sidebarProps
}: React.ComponentProps<typeof Sidebar> & { 
  userInfo?: { name: string; email: string; avatar: string } | null;
  onLogout?: () => void;
}) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar
      collapsible="none"
      className={cn("!border-0 !bg-[#FAFAFA] text-gray-900", className)}
      {...sidebarProps}
    >
      <SidebarHeader className="border-0 flex-col !p-0">
        <div
          className={cn(
            "w-full flex items-center",
            isCollapsed
              ? "justify-center h-10 py-1"
              : "justify-start h-14 px-4 pt-4 pb-1"
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600">
              <Shield className="h-5 w-5 text-white" />
            </div>
            {!isCollapsed && (
              <div>
                <h2 className="text-sm font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  Aura Control Center
                </h2>
                <p className="text-xs text-gray-500">Platform Admin</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Back to Workspace Link */}
        {!isCollapsed && (
          <div className="px-4 py-2 mt-2">
            <Link href="/workspaces">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                <ArrowLeft className="h-3 w-3" />
                Back to Workspace
              </Button>
            </Link>
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="border-0 pt-2">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarMenu>
            <NavItem href="/admin" icon={<LayoutDashboard />}>
              Cockpit View
            </NavItem>
          </SidebarMenu>
        </SidebarGroup>

        <Separator className="my-2 bg-gray-200" />

        {/* Core Management */}
        <SidebarGroup>
          <div className="px-3 py-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Management
            </p>
          </div>
          <SidebarMenu>
            <NavItem href="/admin/users" icon={<Users />}>
              Users
            </NavItem>
            <NavItem href="/admin/workspaces" icon={<Building2 />}>
              Workspaces
            </NavItem>
            <NavItem href="/admin/billing" icon={<DollarSign />}>
              Billing & Finance
            </NavItem>
          </SidebarMenu>
        </SidebarGroup>

        <Separator className="my-2 bg-gray-200" />

        {/* Platform */}
        <SidebarGroup>
          <div className="px-3 py-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Platform
            </p>
          </div>
          <SidebarMenu>
            <NavItem href="/admin/credentials" icon={<Key />}>
              Credentials
            </NavItem>
            <NavItem href="/admin/analytics" icon={<BarChart3 />}>
              Analytics
            </NavItem>
            <NavItem href="/admin/logs" icon={<FileText />}>
              System Logs
            </NavItem>
          </SidebarMenu>
        </SidebarGroup>

        <Separator className="my-2 bg-gray-200" />

        {/* Settings */}
        <SidebarGroup>
          <SidebarMenu>
            <NavItem href="/admin/settings" icon={<Settings />}>
              Settings
            </NavItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-0 flex-col gap-2">
        <NavUser 
          user={userInfo ?? { name: 'Admin', email: '', avatar: '' }} 
          profileHref="/admin/settings"
          onLogout={onLogout}
        />
      </SidebarFooter>
      <SidebarRail className="!hidden" />
    </Sidebar>
  );
}
