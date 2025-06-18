"use client"

import { type LucideIcon, LayoutGrid } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@libs/shadcn-ui/components/ui/sidebar"
import { cn } from "@libs/shadcn-ui/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@libs/shadcn-ui/components/ui/tooltip"
import { useSidebar } from "@libs/shadcn-ui/components/ui/sidebar"

export function NavPlayground({
  items,
  title = "Playground",
}: {
  items: {
    title: string
    url: string
    className?: string
  }[]
  title?: string
  icon?: LucideIcon
}) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            {isCollapsed ? (
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton 
                      asChild 
                      className={cn(
                        item.className,
                        "group/nav-item transition-all hover:scale-110"
                      )}
                    >
                      <a href={item.url}>
                        <LayoutGrid className="size-4 transition-transform group-hover/nav-item:scale-110" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="right" 
                    align="center"
                    className="rounded-xl border-0 bg-gray-100 dark:bg-gray-800 text-md px-3 py-2 font-medium"
                  >
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <SidebarMenuButton 
                asChild 
                className={item.className}
              >
                <a href={item.url}>
                  <LayoutGrid className="size-4" />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
} 