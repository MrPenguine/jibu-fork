"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Building2, Settings, ChevronRight, Bell, Loader2 } from "lucide-react"
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
import { useRouter, usePathname } from 'next/navigation'
import { Dialog } from "../ui/dialog"
import { CreateOrganizationModal } from "./CreateOrganizationModal"
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext'
import { Button } from "@libs/shadcn-ui/components/ui/button"

// Extend the Organization type to include memberStatus
interface ExtendedOrganization {
  id: string;
  name: string;
  role: string;
  memberStatus?: string;
  email?: string;
  settings?: any;
}

// Define the invitation interface
interface Invitation {
  id: string;
  role: string;
  organization?: {
    id: string;
    name: string;
  };
}

// Extended organization context interface
interface ExtendedOrganizationContext {
  activeOrganization: ExtendedOrganization | null;
  organizations: ExtendedOrganization[];
  loading: boolean;
  switchOrganization: (org: ExtendedOrganization) => void;
  refreshOrganizations: () => void;
  incomingInvitations: Invitation[];
  acceptInvitation: (invitationId: string) => Promise<void>;
  rejectInvitation: (invitationId: string) => Promise<void>;
}

export function OrganizationSwitcher() {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const { 
    activeOrganization, 
    organizations, 
    loading, 
    switchOrganization, 
    refreshOrganizations,
    incomingInvitations = [],
    acceptInvitation,
    rejectInvitation
  } = useOrganization() as unknown as ExtendedOrganizationContext

  const handleCreateOrg = () => {
    setIsCreateModalOpen(true);
  };

  const handleOrgSettings = (e: React.MouseEvent, orgId: string) => {
    e.stopPropagation();
    // Navigate to organization settings page
    router.push(`/organizations/${orgId}/settings`);
  };

  // Count of pending invitations
  const pendingInvitationsCount = incomingInvitations?.length || 0;
  
  // Create a section for invited organizations
  const hasInvitedOrganizations = incomingInvitations && incomingInvitations.length > 0;

  // Filter out any organizations that are not active yet (pending invitation)
  const activeOrganizations = (organizations as ExtendedOrganization[]).filter(org => 
    !org.memberStatus || org.memberStatus === 'active'
  );

  // Add more detailed debug logging 
  React.useEffect(() => {
    console.log('OrganizationSwitcher - incomingInvitations:', incomingInvitations);
    console.log('OrganizationSwitcher - pendingInvitationsCount:', pendingInvitationsCount);
    console.log('OrganizationSwitcher - hasInvitedOrganizations:', hasInvitedOrganizations);
    console.log('OrganizationSwitcher - organizations (unfiltered):', organizations);
    console.log('OrganizationSwitcher - activeOrganizations:', activeOrganizations);
    
    // Force component to rerender if invitations change
    if (pendingInvitationsCount > 0) {
      console.log('Has pending invitations, ensuring notification badge is visible');
    }
  }, [incomingInvitations, pendingInvitationsCount, hasInvitedOrganizations, organizations]);

  if (loading || !activeOrganization) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="p-0 bg-violet-50/80 rounded-xl">
            <div className="flex aspect-square size-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight max-w-[160px] ml-3">
              <span className="truncate font-semibold">Loading...</span>
              <span className="truncate text-xs text-gray-500">Please wait</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // If we have no organizations from API, but we're not loading anymore,
  // show a message or UI to create first organization
  if (activeOrganizations.length === 0 && !loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton 
            size="lg"
            onClick={handleCreateOrg}
            className="p-0 bg-violet-50/80 rounded-xl"
          >
            <div className="flex aspect-square size-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300">
              <Plus className="size-5" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight max-w-[160px] ml-3">
              <span className="truncate font-semibold">Create Organization</span>
              <span className="truncate text-xs text-gray-500">You don't have any organizations yet</span>
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
                className="data-[state=open]:bg-violet-100 data-[state=open]:text-foreground p-0 bg-violet-50/80 rounded-xl"
              >
                <div className="flex aspect-square size-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium">
                  {activeOrganization.name.charAt(0).toUpperCase()}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight max-w-[160px] ml-3">
                  <span className="truncate font-semibold">
                    {activeOrganization.name}
                  </span>
                  <span className="truncate text-xs text-gray-500 capitalize">{activeOrganization.role}</span>
                </div>
                <div className="relative ml-auto">
                  {pendingInvitationsCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                      {pendingInvitationsCount}
                    </span>
                  )}
                  <ChevronsUpDown className="h-4 w-4 text-violet-600/70 dark:text-violet-400/70 mr-1" />
                </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-[240px] rounded-xl bg-gray-50 dark:bg-gray-900"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground mb-1">
                ORGANIZATIONS
              </DropdownMenuLabel>
              
              {/* Current organization first with settings button */}
              {activeOrganization && (
                <DropdownMenuItem
                  key={`active-${activeOrganization.id}`}
                  className="flex items-center justify-center gap-2 py-1.5 px-3 cursor-pointer bg-violet-100 dark:bg-violet-900/20 hover:bg-violet-200 dark:hover:bg-violet-900/30 rounded-xl mb-1"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border-0 bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300 font-medium">
                        {activeOrganization.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="max-w-[140px]">
                        <p className="text-sm font-medium truncate">{activeOrganization.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{activeOrganization.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Settings 
                        className="h-4 w-4 text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300" 
                        onClick={(e) => handleOrgSettings(e, activeOrganization.id)}
                      />
                    </div>
                  </div>
                </DropdownMenuItem>
              )}
              
              {/* Other organizations */}
              {activeOrganizations
                .filter(org => org.id !== activeOrganization?.id)
                .map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => switchOrganization(org)}
                    className="flex items-center justify-center gap-2 py-1.5 px-3 cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl border-0 bg-gray-100 dark:bg-gray-800 text-violet-600 dark:text-violet-400 font-medium">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="max-w-[140px]">
                          <p className="text-sm font-medium truncate">{org.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{org.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <ChevronRight className="h-4 w-4 text-violet-600/70 dark:text-violet-400/70" />
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}

              {/* Invited organizations section */}
              {hasInvitedOrganizations && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground mb-1">
                    PENDING INVITATIONS
                  </DropdownMenuLabel>
                  
                  {incomingInvitations.map((invite: Invitation) => {
                    console.log('Rendering invitation:', invite.id, invite.organization?.name);
                    // Find if the organization is already in the list
                    const isPendingMembership = organizations.some(
                      (org: ExtendedOrganization) => 
                        org.id === invite.organization?.id && 
                        org.memberStatus === 'pending'
                    );

                    return (
                      <DropdownMenuItem
                        key={invite.id}
                        className="flex items-center justify-center gap-2 py-1.5 px-3 cursor-default hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                        onSelect={(e) => {
                          // Prevent the dropdown from closing when selecting this item
                          e.preventDefault();
                        }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl border-0 bg-gray-100 dark:bg-gray-800 text-violet-600 dark:text-violet-400 font-medium">
                              {invite.organization?.name?.charAt(0).toUpperCase() || "O"}
                            </div>
                            <div className="max-w-[140px]">
                              <p className="text-sm font-medium truncate">{invite.organization?.name || "Organization"}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {isPendingMembership ? 'Membership pending approval' : `Invited as ${invite.role}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs rounded-xl border-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                console.log(`Accepting invitation ${invite.id} for ${invite.organization?.name}`);
                                acceptInvitation(invite.id)
                                  .then(() => {
                                    console.log('Invitation accepted successfully');
                                  })
                                  .catch((err: Error) => {
                                    console.error('Error accepting invitation:', err);
                                  });
                              }}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs rounded-xl border-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                console.log(`Rejecting invitation ${invite.id} for ${invite.organization?.name}`);
                                rejectInvitation(invite.id)
                                  .then(() => {
                                    console.log('Invitation rejected successfully');
                                  })
                                  .catch((err: Error) => {
                                    console.error('Error rejecting invitation:', err);
                                  });
                              }}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </>
              )}

              {/* Remove redundant OrganizationInvites component */}
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                className="flex items-center justify-center gap-2 py-1.5 px-3 cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={handleCreateOrg}
              >
                <div className="flex size-8 items-center justify-center rounded-xl border-0 bg-gray-100 dark:bg-gray-800 text-violet-600 dark:text-violet-400">
                  <Plus className="size-3.5" />
                </div>
                <div className="font-medium text-sm truncate">Create organization</div>
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