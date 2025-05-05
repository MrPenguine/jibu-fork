"use client"

import * as React from "react"
import {
  Building2,
  CreditCard,
  FileCog,
  Files,
  Home,
  Key,
  LayoutDashboard,
  LayoutGrid,
  MessageSquare,
  PieChart,
  Settings,
  UserCircle,
  Users,
  Wrench,
} from "lucide-react"

import { NavPlayground } from "@libs/shadcn-ui/components/nav/nav-playground"
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

// Custom NavPlayground component with active state styling and tooltip
function CustomNavPlayground({ 
  items, 
  title 
}: { 
  items: { title: string; url: string; icon?: React.ReactNode }[]; 
  title: string;
}) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = pathname === item.url;
          const itemClassName = cn(
            "rounded-xl transition-colors",
            isActive 
              ? "bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300" 
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          );
          
          return (
            <SidebarMenuItem key={item.title}>
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
                        <a href={item.url}>
                          {item.icon || <LayoutGrid className={cn(
                            "size-4 transition-transform group-hover/nav-item:scale-110",
                            isActive ? "text-violet-700 dark:text-violet-300" : ""
                          )} />}
                          <span>{item.title}</span>
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
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <SidebarMenuButton 
                  asChild 
                  className={itemClassName}
                >
                  <a href={item.url}>
                    {item.icon || <LayoutGrid className={cn(
                      "size-4",
                      isActive ? "text-violet-700 dark:text-violet-300" : ""
                    )} />}
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function CustomAppSidebar({ className, navUserProps = {}, ...sidebarProps }: React.ComponentProps<typeof Sidebar> & { navUserProps?: any }) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  
  // Updated navigation data with appropriate icons
  const navData = {
    user: {
      name: "User",
      email: "user@example.com",
      avatar: "/avatars/default.jpg",
    },
    overview: [
      {
        title: "Dashboard",
        url: "/",
        icon: <LayoutDashboard className="size-4" />
      }
    ],
    build: [
      {
        title: "Assistants",
        url: "#",
        icon: <MessageSquare className="size-4" />
      },
      {
        title: "Workflows",
        url: "#",
        icon: <FileCog className="size-4" />
      },
      {
        title: "Phone Numbers",
        url: "#",
        icon: <CreditCard className="size-4" />
      },
      {
        title: "Tools",
        url: "#",
        icon: <Wrench className="size-4" />
      },
      {
        title: "Files",
        url: "/organizations/file",
        icon: <Files className="size-4" />
      },
      {
        title: "Squads",
        url: "#",
        icon: <Users className="size-4" />
      },
      {
        title: "Provider Keys",
        url: "/organizations/keys",
        icon: <Key className="size-4" />
      },
    ],
    test: [
      {
        title: "Voice Test Suites",
        url: "#",
        icon: <PieChart className="size-4" />
      },
    ],
    observe: [
      {
        title: "Call Logs",
        url: "#",
        icon: <FileCog className="size-4" />
      },
      {
        title: "API Logs",
        url: "#",
        icon: <FileCog className="size-4" />
      },
      {
        title: "Webhook Logs",
        url: "#",
        icon: <FileCog className="size-4" />
      },
    ],
    community: [
      {
        title: "Voice Library",
        url: "#",
        icon: <LayoutGrid className="size-4" />
      },
    ],
    orgSettings: [
      {
        title: "Billing & Addons",
        url: "#",
        icon: <CreditCard className="size-4" />
      },
      {
        title: "Members",
        url: "/organizations/members",
        icon: <Users className="size-4" />
      },
      {
        title: "Org Settings",
        url: "/organizations/settings",
        icon: <Settings className="size-4" />
      },
      {
        title: "API Keys",
        url: "/organizations/settings/api-keys",
        icon: <Key className="size-4" />
      },
    ],
  };

  return (
    <Sidebar 
      collapsible="icon" 
      className={cn("!border-0 !bg-gray-50/80 dark:!bg-gray-900/95", className)}
      {...sidebarProps}
    >
      <SidebarHeader className="border-0 flex-col !p-0">
        <div className={cn(
          "w-full flex items-center",
          isCollapsed ? "justify-center h-10 py-1" : "justify-start h-14 px-4 pt-4 pb-1"
        )}>
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
        <CustomNavPlayground items={navData.overview} title="Overview" />
        <CustomNavPlayground items={navData.build} title="Build" />
        <CustomNavPlayground items={navData.test} title="Test" />
        <CustomNavPlayground items={navData.observe} title="Observe" />
        <CustomNavPlayground items={navData.community} title="Community" />
        <CustomNavPlayground items={navData.orgSettings} title="Org Settings" />
      </SidebarContent>
      <SidebarFooter className="border-0">
        <NavUser user={navData.user} {...navUserProps} />
      </SidebarFooter>
      <SidebarRail className="!hidden" />
    </Sidebar>
  )
} 