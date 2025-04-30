"use client"

import * as React from "react"
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  CreditCard,
  Frame,
  GalleryVerticalEnd,
  Key,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  Users,
} from "lucide-react"

import { NavMain } from "@libs/shadcn-ui/components/nav/nav-main"
import { NavProjects } from "@libs/shadcn-ui/components/nav/nav-projects"
import { NavUser } from "@libs/shadcn-ui/components/nav/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@libs/shadcn-ui/components/ui/sidebar"
import { OrganizationSwitcher } from "@libs/shadcn-ui/components/organization/OrganizationSwitcher"

// Sample data for navigation items
const navData = {
  user: {
    name: "User",
    email: "user@example.com",
    avatar: "/avatars/default.jpg",
  },
  navMain: [
    {
      title: "Playground",
      url: "#",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "History",
          url: "#",
        },
        {
          title: "Starred",
          url: "#",
        },
        {
          title: "Settings",
          url: "#",
        },
      ],
    },
    {
      title: "Models",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "Genesis",
          url: "#",
        },
        {
          title: "Explorer",
          url: "#",
        },
        {
          title: "Quantum",
          url: "#",
        },
      ],
    },
    {
      title: "Documentation",
      url: "#",
      icon: BookOpen,
      items: [
        {
          title: "Introduction",
          url: "#",
        },
        {
          title: "Get Started",
          url: "#",
        },
        {
          title: "Tutorials",
          url: "#",
        },
        {
          title: "Changelog",
          url: "#",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "#",
        },
        {
          title: "Team",
          url: "#",
        },
        {
          title: "Billing",
          url: "#",
        },
        {
          title: "Limits",
          url: "#",
        },
      ],
    },
  ],
  Organization: [
    {
      name: "Settings",
      url: "/organizations/settings",
      icon: Settings2,
    },
    {
      name: "Members",
      url: "/organizations/members",
      icon: Users,
    },
    {
      name: "Billing",
      url: "/organizations/billing",
      icon: CreditCard,
    },
    {
      name: "API Keys",
      url: "/organizations/api-keys",
      icon: Key,
    },
  ],
  overview: {
    title: "Overview",
    url: "/",
    icon: PieChart,
    isActive: true,
  },
}

export function CustomAppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navData.navMain} />
        <NavProjects organization={navData.Organization} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
} 