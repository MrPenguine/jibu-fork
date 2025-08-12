"use client"

import * as React from "react"
import {
  CreditCard,
  FileCog,
  Files,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react"

import { NavUser } from "@libs/shadcn-ui/components/nav/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@libs/shadcn-ui/components/ui/sidebar"
import { OrganizationSwitcher } from "@libs/shadcn-ui/components/organization/OrganizationSwitcher"
import { cn } from "@libs/shadcn-ui/lib/utils"
import { usePathname } from "next/navigation"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@libs/shadcn-ui/components/ui/tooltip"
import { Separator } from "@libs/shadcn-ui/components/ui/separator"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@libs/shadcn-ui/components/ui/accordion"
import { useTranslations } from "@libs/shadcn-ui/lib/i18n"
import { useOrganization } from "../../../../../apps/frontend/src/utils/organizationContext"
import { fetchAPI } from "../../../../../apps/frontend/src/utils/api"

function NavItem({ 
  href, 
  icon, 
  children 
}: {
  href: string;
  icon: React.ReactElement<{ className?: string }>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isActive = pathname === href;

  const itemClassName = cn(
    "rounded-xl transition-colors",
    isActive
      ? "bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
      : "hover:bg-gray-100 dark:hover:bg-gray-800"
  );

  return (
    <SidebarMenuItem>
      {isCollapsed ? (
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <SidebarMenuButton
                asChild
                className={cn(
                  itemClassName,
                  "group/nav-item transition-all hover:scale-110"
                )}
              >
                <a href={href}>
                  {React.cloneElement(icon, {
                    className: cn(
                      "size-4 transition-transform group-hover/nav-item:scale-110",
                      isActive ? "text-violet-700 dark:text-violet-300" : ""
                    ),
                  })}
                  <span>{children}</span>
                </a>
              </SidebarMenuButton>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="center"
              className={cn(
                "rounded-xl border-0 text-md px-3 py-2 font-medium",
                isActive
                  ? "bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
                  : "bg-gray-100 dark:bg-gray-800"
              )}
            >
              {children}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <SidebarMenuButton asChild className={itemClassName}>
          <a href={href}>
            {React.cloneElement(icon, {
              className: cn(
                "size-4",
                isActive ? "text-violet-700 dark:text-violet-300" : ""
              ),
            })}
            <span>{children}</span>
          </a>
        </SidebarMenuButton>
      )}
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
  const { activeOrganization } = useOrganization();
  const wsBase = activeOrganization ? `/workspace/${activeOrganization.id}` : null;

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
      collapsible="icon"
      className={cn("!border-0 !bg-gray-50/80 dark:!bg-gray-900/95", className)}
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
            src="/logo.svg"
            alt="Jibu.ai Logo"
            className={cn(
              "transition-all duration-200 ease-in-out",
              isCollapsed ? "w-8 h-8" : "w-24 h-auto"
            )}
          />
        </div>
        {!isCollapsed && (
          <div className="px-4 py-2 mt-1 mb-2">
            <div className="p-1 bg-violet-50/50 dark:bg-gray-800/50 rounded-xl">
              <OrganizationSwitcher />
            </div>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="border-0 pt-0">
        {wsBase && (
          <>
            {/* Group 1: Workspace */}
            <SidebarGroup>
              <SidebarGroupLabel>{t("Workspace")}</SidebarGroupLabel>
              <SidebarMenu>
                <NavItem href={`${wsBase}`} icon={<LayoutDashboard />}>
                  {t("Home")}
                </NavItem>
                <NavItem href={`${wsBase}/assistants`} icon={<MessageSquare />}>
                  {t("Assistants")}
                </NavItem>
                <NavItem href={`${wsBase}/files`} icon={<Files />}>
                  {t("Files")}
                </NavItem>
              </SidebarMenu>
            </SidebarGroup>

            <Separator className="my-2" />

            {/* Group 2: Management & Settings */}
            <SidebarGroup>
              <SidebarGroupLabel>{t("Management")}</SidebarGroupLabel>
              <SidebarMenu>
                <NavItem href={`${wsBase}/settings`} icon={<Settings />}>
                  {t("Settings")}
                </NavItem>
                <NavItem href={`${wsBase}/settings/members`} icon={<Users />}>
                  {t("Members")}
                </NavItem>
                <NavItem href={`${wsBase}/settings/billing`} icon={<CreditCard />}>
                  {t("Billing")}
                </NavItem>
              </SidebarMenu>
            </SidebarGroup>

            <Separator className="my-2" />

            {/* Group 3: Help & Community */}
            <SidebarGroup>
              <SidebarGroupLabel>{t("Support")}</SidebarGroupLabel>
              <SidebarMenu>
                <NavItem href="/docs" icon={<FileCog />}>
                  {t("Documentation")}
                </NavItem>
                <NavItem href="/support" icon={<LayoutGrid />}>
                  {t("Help")}
                </NavItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-0">
        <NavUser 
          user={userInfo ?? { name: 'User', email: '', avatar: '' }} 
          profileHref={wsBase ? `${wsBase}/settings` : "/organizations"}
          {...navUserProps} 
        />
      </SidebarFooter>
      <SidebarRail className="!hidden" />
    </Sidebar>
  );
}