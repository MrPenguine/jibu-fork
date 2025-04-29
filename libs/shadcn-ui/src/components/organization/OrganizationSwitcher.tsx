"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Building2, Settings, ChevronRight } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@libs/shadcn-ui/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@libs/shadcn-ui/components/ui/sidebar"
import { useRouter } from 'next/navigation'
import { Dialog } from "../ui/dialog"
import { CreateOrganizationModal } from "./CreateOrganizationModal"
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext'

export function OrganizationSwitcher() {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const { activeOrganization, organizations, loading, switchOrganization, refreshOrganizations } = useOrganization()

  const handleCreateOrg = () => {
    setIsCreateModalOpen(true);
  };

  const handleOrgSettings = (e: React.MouseEvent, orgId: string) => {
    e.stopPropagation();
    // Navigate to organization settings page
    router.push(`/organizations/${orgId}/settings`);
  };

  if (loading || !activeOrganization) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Building2 className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Loading...</span>
              <span className="truncate text-xs">Please wait</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // If we have no organizations from API, but we're not loading anymore,
  // show a message or UI to create first organization
  if (organizations.length === 0 && !loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton 
            size="lg"
            onClick={handleCreateOrg}
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Plus className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">Create Organization</span>
              <span className="truncate text-xs">You don't have any organizations yet</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {activeOrganization.name}
                  </span>
                  <span className="truncate text-xs capitalize">{activeOrganization.role}</span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-[240px] rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground mb-1">
                Organizations
              </DropdownMenuLabel>
              
              {/* Current organization first with settings button */}
              {activeOrganization && (
                <DropdownMenuItem
                  key={`active-${activeOrganization.id}`}
                  className="flex items-center gap-2 p-2 cursor-pointer bg-muted/20 hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-gray-100 dark:bg-gray-800">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{activeOrganization.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{activeOrganization.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Settings 
                        className="h-4 w-4 text-muted-foreground hover:text-foreground" 
                        onClick={(e) => handleOrgSettings(e, activeOrganization.id)}
                      />
                    </div>
                  </div>
                </DropdownMenuItem>
              )}
              
              {/* Other organizations */}
              {organizations
                .filter(org => org.id !== activeOrganization?.id)
                .map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => switchOrganization(org)}
                    className="flex items-center gap-2 p-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md border bg-gray-100 dark:bg-gray-800">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{org.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{org.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                className="gap-2 p-2 cursor-pointer"
                onClick={handleCreateOrg}
              >
                <div className="flex size-7 items-center justify-center rounded-md border bg-background">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-sm">Create organization</div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateOrganizationModal 
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={refreshOrganizations}
      />
    </>
  )
} 