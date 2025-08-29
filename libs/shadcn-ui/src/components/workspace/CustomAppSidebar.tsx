"use client"

import * as React from "react"
import { useSidebar } from "@libs/shadcn-ui/components/ui/sidebar"
import { cn } from "@libs/shadcn-ui/lib/utils"
import { useTranslations } from "@libs/shadcn-ui/lib/i18n"
import { useWorkspace } from "../../../../../apps/frontend/src/utils/workspaceContext"
import { fetchAPI } from "../../../../../apps/frontend/src/utils/api"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from "@libs/shadcn-ui/components/ui/sidebar"
import { NavUser } from "@libs/shadcn-ui/components/nav/nav-user"
import { Separator } from "@libs/shadcn-ui/components/ui/separator"
import { Badge } from "@libs/shadcn-ui/components/ui/badge"
import { WorkspaceSwitcher } from "@libs/shadcn-ui/components/workspace/WorkspaceSwitcher"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  CreditCard,
  FileCog,
  FileText,
  Files,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  Settings,
  Users,
  Phone,
  Briefcase,
  BarChart,
} from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@libs/shadcn-ui/components/ui/tooltip"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@libs/shadcn-ui/components/ui/accordion"

function NavItem({ 
  href, 
  icon, 
  children,
  counter,
  badge
}: {
  href: string;
  icon: React.ReactElement<{ className?: string }>;
  children: React.ReactNode;
  counter?: number;
  badge?: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(`${href}/`);
  
  return (
    <SidebarMenuItem>
      <div className={cn(
        "w-full flex items-center gap-2 text-sm px-3 py-2 rounded-md transition-colors",
        isActive ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
      )}>
        <Link href={href} className="w-full flex items-center gap-2">
          {React.cloneElement(icon, {
            className: cn("h-4 w-4", icon.props.className),
          })}
          <span className="flex-1">{children}</span>
          {counter !== undefined && (
            <Badge variant="outline" className="ml-auto text-xs py-0 h-5 px-2 bg-gray-800">
              {counter}
            </Badge>
          )}
          {badge && (
            <Badge variant="outline" className="ml-auto text-xs py-0 h-5 px-2 bg-gray-800">
              {badge}
            </Badge>
          )}
        </Link>
      </div>
    </SidebarMenuItem>
  );
}

export function CustomAppSidebar({
  className,
  navUserProps = {},
  ...sidebarProps
}: React.ComponentProps<typeof Sidebar> & { navUserProps?: any }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const t = useTranslations("Sidebar");
  const { activeWorkspace } = useWorkspace();
  const wsBase = activeWorkspace ? `/workspace/${activeWorkspace.id}` : null;

  const [userInfo, setUserInfo] = React.useState<{ name: string; email: string; avatar: string } | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      try {
        const data = await fetchAPI('/users/me');
        if (!mounted) return;
        const name =
          data?.fullName ||
          (data?.firstName && data?.lastName ? `${data.firstName} ${data.lastName}` : data?.firstName) ||
          data?.email ||
          'User';
        const avatar = data?.imageUrl || '';
        const email = data?.email || '';
        setUserInfo({ name, email, avatar });
      } catch (e) {
        if (mounted) setUserInfo({ name: 'User', email: '', avatar: '' });
      }
    };
    loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Sidebar
      collapsible="none"
      className={cn("!border-0 !bg-gray-900 text-white", className)}
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
          <img
            src="/logo-dark.svg"
            alt="Jibu.ai Logo"
            className={cn(
              "transition-all duration-200 ease-in-out",
              isCollapsed ? "w-8 h-8" : "w-40 h-auto"
            )}
          />
        </div>
        {!isCollapsed && (
          <div className="px-4 py-2 mt-1 mb-2">
            <div className="p-1 bg-violet-50/50 dark:bg-gray-800/50 rounded-xl">
              <WorkspaceSwitcher />
            </div>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="border-0 pt-0">
        {wsBase && (
          <>
            {/* Main Navigation */}
            <SidebarGroup>
              <SidebarMenu>
                <NavItem href={`${wsBase}`} icon={<LayoutDashboard />}>
                  {t("Home")}
                </NavItem>
                <NavItem 
                  href={`${wsBase}/agents`} 
                  icon={<MessageSquare />}
                  counter={5} // This would be a dynamic value from API in production
                >
                  {t("Agents")}
                </NavItem>
              </SidebarMenu>
            </SidebarGroup>

            <Separator className="my-2" />

            {/* Management */}
            <SidebarGroup>
              <SidebarMenu>
                <NavItem 
                  href={`${wsBase}/phone-numbers`} 
                  icon={<Phone />}
                  counter={2} // This would be a dynamic value from API in production
                >
                  {t("Phone Numbers")}
                </NavItem>
                <NavItem 
                  href={`${wsBase}/members`} 
                  icon={<Users />}
                  counter={8} // This would be a dynamic value from API in production
                >
                  {t("Members")}
                </NavItem>
                <NavItem 
                  href={`${wsBase}/usage`} 
                  icon={<BarChart />}
                  counter={0} // This would be a dynamic value from API in production
                >
                  {t("Usage")}
                </NavItem>
                <NavItem 
                  href={`${wsBase}/billing`} 
                  icon={<CreditCard />}
                  badge="Pro" // This would be the current plan from API in production
                >
                  {t("Plans & Billing")}
                </NavItem>
              </SidebarMenu>
            </SidebarGroup>

            <Separator className="my-2" />

            {/* Learn & Support */}
            <SidebarGroup>
              <SidebarMenu>
                <NavItem href="/learn" icon={<BookOpen />}>
                  {t("Learn")}
                </NavItem>
                <NavItem href="/documentation" icon={<FileText />}>
                  {t("Documentation")}
                </NavItem>
                <NavItem href="/changelog" icon={<Files />}>
                  {t("Changelog")}
                </NavItem>
                <NavItem href="/hire-pro" icon={<Briefcase />}>
                  {t("Hire a Pro")}
                </NavItem>
              </SidebarMenu>
            </SidebarGroup>

            {/* Removed Payment Widget from here - moved to footer */}
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-0 flex-col gap-2">
        {/* Payment Widget */}
        <div className="px-4 mb-2">
          <div className="bg-violet-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
            <div className="font-medium mb-1">Payment Widget</div>
            <div className="text-xs text-muted-foreground">Manage your subscription and billing</div>
          </div>
        </div>
        <NavItem href={`${wsBase}/settings`} icon={<Settings />}>
          {t("Settings")}
        </NavItem>
        <NavUser 
          user={userInfo ?? { name: 'User', email: '', avatar: '' }} 
          profileHref={wsBase ? `${wsBase}/settings` : "/workspaces"}
          {...navUserProps} 
        />
      </SidebarFooter>
      <SidebarRail className="!hidden" />
    </Sidebar>
  );
}