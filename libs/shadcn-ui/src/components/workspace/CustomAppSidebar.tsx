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
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
  Phone,
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
  badge,
  isHome
}: {
  href: string;
  icon: React.ReactElement<{ className?: string }>;
  children: React.ReactNode;
  counter?: number;
  badge?: string;
  isHome?: boolean;
}) {
  const pathname = usePathname();
  // For home, only match exact path. For others, match if path starts with href
  const isActive = isHome 
    ? pathname === href 
    : pathname === href || pathname?.startsWith(`${href}/`);
  
  return (
    <SidebarMenuItem>
      <div className={cn(
        "w-full flex items-center gap-2.5 text-sm px-3 py-2 rounded-lg transition-all duration-150",
        isActive ? "bg-[#E6F7F0] text-[#009959] font-semibold" : "text-[#3a3f44] hover:bg-gray-100 hover:text-[#009959]"
      )}>
        <Link href={href} className="w-full flex items-center gap-2">
          {React.cloneElement(icon, {
            className: cn("h-4 w-4", icon.props.className),
          })}
          <span className="flex-1">{children}</span>
          {counter !== undefined && (
            <Badge variant="outline" className="ml-auto text-xs py-0 h-5 px-2 bg-[#CBF3FC] text-[#222E50] border-[#CBF3FC]">
              {counter}
            </Badge>
          )}
          {badge && (
            <Badge variant="outline" className="ml-auto text-xs py-0 h-5 px-2 bg-[#F9C116] text-[#22262A] border-[#F9C116]">
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
      className={cn("!border-0 !bg-[#FAFAFA] text-[#22262A]", className)}
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
            <div className="p-1 bg-gray-50 rounded-xl">
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
              <SidebarGroupLabel className="px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Workspace
              </SidebarGroupLabel>
              <SidebarMenu>
                <NavItem href={`${wsBase}`} icon={<LayoutDashboard />} isHome={true}>
                  {t("Home")}
                </NavItem>
                <NavItem 
                  href={`${wsBase}/agents`} 
                  icon={<MessageSquare />}
                >
                  {t("Agents")}
                </NavItem>
              </SidebarMenu>
            </SidebarGroup>

            <Separator className="my-2 bg-gray-200" />

            {/* Management */}
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Manage
              </SidebarGroupLabel>
              <SidebarMenu>
                <NavItem 
                  href={`${wsBase}/phone-numbers`} 
                  icon={<Phone />}
                >
                  {t("Phone Numbers")}
                </NavItem>
                <NavItem 
                  href={`${wsBase}/members`} 
                  icon={<Users />}
                >
                  {t("Members")}
                </NavItem>
                <NavItem 
                  href={`${wsBase}/usage`} 
                  icon={<BarChart />}
                >
                  {t("Usage")}
                </NavItem>
                <NavItem 
                  href={`${wsBase}/billing`} 
                  icon={<CreditCard />}
                >
                  {t("Plans & Billing")}
                </NavItem>
              </SidebarMenu>
            </SidebarGroup>

          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-0 flex-col gap-2">
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