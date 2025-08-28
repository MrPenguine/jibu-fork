"use client"

import * as React from "react"
import { SidebarProvider } from "@libs/shadcn-ui/components/ui/sidebar"
import { CustomAppSidebar } from "../../../../../libs/shadcn-ui/src/components/workspace/CustomAppSidebar"
import { SidebarInset, SidebarTrigger } from "@libs/shadcn-ui/components/ui/sidebar"
import { Separator } from "@libs/shadcn-ui/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@libs/shadcn-ui/components/ui/breadcrumb"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { logout } from "../../utils/auth/actions"
import { Toaster } from "@libs/shadcn-ui/components/ui/toaster"
import { WorkspaceProvider } from "../../utils/workspaceContext"
import { usePathname } from "next/navigation"
import { useMemo } from "react"

function DynamicBreadcrumbs() {
  const pathname = usePathname();
  
  const breadcrumbs = useMemo(() => {
    // Remove leading slash and split path
    const parts = pathname.replace(/^\//, '').split('/');
    
    if (parts[0] === '') {
      // Home page
      return [
        { label: "Dashboard", path: "/", isLast: true }
      ];
    }
    
    // Create breadcrumb items
    const items = [];
    let currentPath = '';
    
    // Always add Dashboard as first item
    items.push({
      label: "Dashboard",
      path: "/",
      isLast: parts.length === 0
    });
    
    // Add remaining path segments
    parts.forEach((part, index) => {
      currentPath += `/${part}`;
      const isLast = index === parts.length - 1;
      
      // Format the label (capitalize, replace hyphens with spaces)
      let label = part.replace(/-/g, ' ');
      
      // Special case for workspace paths
      if (part === 'workspace' && isLast) {
        label = 'Workspaces';
      } else if (part === 'workspace' && !isLast) {
        label = 'Workspaces';
      } else if (part === 'settings' && parts[index-1] === 'workspace') {
        label = 'Settings';
      }
      
      // Capitalize each word
      label = label.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      
      items.push({
        label,
        path: currentPath,
        isLast
      });
    });
    
    return items;
  }, [pathname]);
  
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((item, index) => (
          <React.Fragment key={item.path}>
            <BreadcrumbItem className={index === 0 && breadcrumbs.length > 1 ? "hidden md:block" : ""}>
              {item.isLast ? (
                <BreadcrumbPage className="text-violet-700 dark:text-violet-300">{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={item.path}>{item.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!item.isLast && <BreadcrumbSeparator className={index === 0 && breadcrumbs.length > 1 ? "hidden md:block" : ""} />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const handleLogout = () => {
    logout(new FormData());
  };
  
  const pathname = usePathname();
  const isAgentPage = pathname.includes('/agent/');
  
  if (isAgentPage) {
    return (
      <WorkspaceProvider>
        {children}
        <Toaster />
      </WorkspaceProvider>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-row">
      <SidebarProvider>
        <WorkspaceProvider>
          <CustomAppSidebar navUserProps={{ onLogout: handleLogout }} />
          <SidebarInset className="bg-white flex-1 flex flex-col">
            <header className="flex h-16 w-full shrink-0 items-center gap-2 px-4">
              <div className="flex items-center gap-2">
                {/* Removed breadcrumb navigation */}
              </div>
            </header>
            <main className="flex-1 w-full">
              {children}
            </main>
          </SidebarInset>
          <Toaster />
        </WorkspaceProvider>
      </SidebarProvider>
    </div>
  );
} 