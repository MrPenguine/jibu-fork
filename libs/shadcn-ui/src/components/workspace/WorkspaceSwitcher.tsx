"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Building2, Settings, ChevronRight, Bell, Loader2, Clock } from "lucide-react"
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
import { CreateWorkspaceModal } from "./CreateWorkspaceModal"
import { useWorkspace } from '../../../../../apps/frontend/src/utils/workspaceContext'
import { Button } from "@libs/shadcn-ui/components/ui/button"

// Extend the Workspace type to include status
interface ExtendedWorkspace {
  id: string;
  name: string;
  role: string;
  status?: string;
  email?: string;
  settings?: any;
}

// Define the invitation interface
interface Invitation {
  id: string;
  role: string;
  workspace?: {
    id: string;
    name: string;
  };
}

// Extended workspace context interface
interface ExtendedWorkspaceContext {
  activeWorkspace: ExtendedWorkspace | null;
  workspaces: ExtendedWorkspace[];
  loading: boolean;
  switchWorkspace: (ws: ExtendedWorkspace) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  incomingInvitations: Invitation[];
  acceptInvitation: (invitationId: string) => Promise<void>;
  rejectInvitation: (invitationId: string) => Promise<void>;
}

export function WorkspaceSwitcher() {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [showAllInvitations, setShowAllInvitations] = React.useState(false)
  const [expandedInvitationId, setExpandedInvitationId] = React.useState<string | null>(null)
  const { 
    activeWorkspace, 
    workspaces, 
    loading, 
    switchWorkspace, 
    refreshWorkspaces,
    incomingInvitations = [],
    acceptInvitation,
    rejectInvitation
  } = useWorkspace() as unknown as ExtendedWorkspaceContext

  const handleCreateWorkspace = () => {
    setIsCreateModalOpen(true);
  };

  const handleWorkspaceSettings = (e: React.MouseEvent, wsId: string) => {
    e.stopPropagation();
    // Navigate to workspace settings page
    router.push(`/workspace/${wsId}/settings`);
  };

  // Find workspaces with pending status first
  const pendingWorkspaces = workspaces.filter(ws => 
    ws.status === 'pending'
  );

  // Get IDs of all pending workspaces for more reliable filtering
  const pendingWorkspaceIds = pendingWorkspaces.map(ws => ws.id);

  // Get IDs of all workspaces in incoming invitations
  const invitationWorkspaceIds = incomingInvitations
    .filter(invite => invite.workspace)
    .map(invite => invite.workspace?.id)
    .filter(Boolean) as string[];

  // Combined set of IDs to exclude from active workspaces
  const excludeWorkspaceIds = [...pendingWorkspaceIds, ...invitationWorkspaceIds];

  // Filter active workspaces, excluding any that are pending or in invitations
  const activeWorkspaces = workspaces.filter(workspace => 
    (!workspace.status || workspace.status === 'active') && 
    !excludeWorkspaceIds.includes(workspace.id)
  );
  
  // Improved calculation for totalPendingCount to prevent duplicates
  const directInvitationsCount = incomingInvitations.filter(invite => 
    !workspaces.some(ws => ws.id === invite.workspace?.id)
  ).length;

  const pendingWorkspacesCount = pendingWorkspaces.length;

  // Calculate total without duplicates
  const totalPendingCount = directInvitationsCount + pendingWorkspacesCount;
  
  // Check if we have any pending items to show
  const hasPendingItems = totalPendingCount > 0;

  // Update the logging to help troubleshoot the count issue
  React.useEffect(() => {
    console.log('WorkspaceSwitcher - Workspaces:', workspaces);
    console.log('WorkspaceSwitcher - activeWorkspaces:', activeWorkspaces);
    console.log('WorkspaceSwitcher - pendingWorkspaces:', pendingWorkspaces);
    console.log('WorkspaceSwitcher - incomingInvitations:', incomingInvitations);
    console.log('WorkspaceSwitcher - Direct invitations count:', incomingInvitations.filter(invite => 
      !workspaces.some(ws => ws.id === invite.workspace?.id)
    ).length);
    console.log('WorkspaceSwitcher - totalPendingCount:', totalPendingCount);
  }, [workspaces, activeWorkspaces, pendingWorkspaces, incomingInvitations, totalPendingCount]);

  // Add logic to prioritize owner workspaces when invitations are pending
  React.useEffect(() => {
    // Only run if there are pending invitations and the active workspace has a pending state
    if (
      (totalPendingCount > 0 || pendingWorkspaces.length > 0) && 
      activeWorkspace &&
      (
        pendingWorkspaceIds.includes(activeWorkspace.id) || 
        invitationWorkspaceIds.includes(activeWorkspace.id) || 
        activeWorkspace.status === 'pending'
      )
    ) {
      console.log('Active workspace is pending - switching to owned workspace');
      
      // Find a workspace where the user is an owner
      const ownedWorkspace = activeWorkspaces.find(ws => ws.role === 'owner');
      
      // If found, switch to it
      if (ownedWorkspace) {
        console.log('Switching to owned workspace:', ownedWorkspace);
        switchWorkspace(ownedWorkspace).catch((err) => {
          console.error('Error auto-switching to owned workspace:', err);
        });
      } else {
        // Fallback to any active workspace (if there is one)
        const firstActiveWorkspace = activeWorkspaces[0];
        if (firstActiveWorkspace && firstActiveWorkspace.id !== activeWorkspace.id) {
          console.log('Switching to first active workspace:', firstActiveWorkspace);
          switchWorkspace(firstActiveWorkspace).catch((err) => {
            console.error('Error auto-switching to first active workspace:', err);
          });
        }
      }
    }
  }, [
    activeWorkspace,
    activeWorkspaces,
    pendingWorkspaceIds,
    invitationWorkspaceIds,
    totalPendingCount,
    pendingWorkspaces.length,
    switchWorkspace
  ]);

  // Targeted logging to detect problematic state (workspace auto-selection)
  React.useEffect(() => {
    console.log(`[WorkspaceSwitcher LOG] loading=${loading}, activeWs=${activeWorkspace?.id}, wsCount=${workspaces.length}`);
    // THE CRITICAL CHECK:
    if (!loading && !activeWorkspace && workspaces && workspaces.length > 0) {
      // Check if this component is *already* selecting the first workspace
      // (e.g., if a <Select> component has its own internal default value logic)
      console.error(`[WorkspaceSwitcher DETECTED] Context loaded, no active workspace, but workspaces exist. Potential auto-selection happening! First workspace is: ${workspaces[0]?.id} (${workspaces[0]?.name}). Check if switchWorkspace is being called below this line or if UI element defaults!`);
      
      // Fix: Automatically select the first active workspace
      // Find a workspace where the user is an owner
      const ownedWorkspace = activeWorkspaces.find(ws => ws.role === 'owner');
      
      if (ownedWorkspace) {
        console.log('[WorkspaceSwitcher AUTO-SELECT] Selecting owned workspace:', ownedWorkspace.name);
        switchWorkspace(ownedWorkspace).catch((err) => {
          console.error('Error auto-selecting owned workspace:', err);
        });
      } else if (activeWorkspaces.length > 0) {
        // Fallback to the first active workspace
        console.log('[WorkspaceSwitcher AUTO-SELECT] Selecting first active workspace:', activeWorkspaces[0].name);
        switchWorkspace(activeWorkspaces[0]).catch((err) => {
          console.error('Error auto-selecting first active workspace:', err);
        });
      } else if (workspaces.length > 0) {
        // Last resort: use any workspace available
        console.log('[WorkspaceSwitcher AUTO-SELECT] Selecting first available workspace:', workspaces[0].name);
        switchWorkspace(workspaces[0]).catch((err) => {
          console.error('Error auto-selecting first available workspace:', err);
        });
      }
    }
  }, [loading, activeWorkspace, workspaces, activeWorkspaces, switchWorkspace]);

  // Define the maximum number of invitations to show before "Show more" button
  const MAX_VISIBLE_INVITATIONS = 2;
  
  // Handle invitation click to toggle expanded state
  const handleInvitationClick = (id: string) => {
    setExpandedInvitationId(expandedInvitationId === id ? null : id);
  };

  // Get all pending items (direct invitations and pending workspaces)
  const getAllPendingItems = () => {
    const directInvitations = incomingInvitations.filter(invite => 
      !workspaces.some(ws => ws.id === invite.workspace?.id)
    );
    
    const pendingWorkspacesWithInvitations = pendingWorkspaces.map(ws => {
      const matchingInvitation = incomingInvitations.find(
        invite => invite.workspace?.id === ws.id
      );
      
      return {
        ...ws,
        invitationId: matchingInvitation?.id || `pending-${ws.id}`,
        matchingInvitation
      };
    });
    
    return [...directInvitations.map(invite => ({
      id: invite.id,
      name: invite.workspace?.name || "Workspace",
      role: invite.role,
      type: 'direct',
      invitation: invite
    })), ...pendingWorkspacesWithInvitations.map(ws => ({
      id: ws.invitationId,
      name: ws.name,
      role: ws.matchingInvitation?.role || 'member',
      type: 'pending',
      workspace: ws,
      invitation: ws.matchingInvitation
    }))];
  };

  if (loading || !activeWorkspace) {
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

  // If we have no active workspaces, but we're not loading anymore,
  // show a message or UI to create first workspace
  if (activeWorkspaces.length === 0 && !loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton 
            size="lg"
            onClick={handleCreateWorkspace}
            className="p-0 bg-violet-50/80 rounded-xl"
          >
            <div className="flex aspect-square size-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300">
              <Plus className="size-5" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight max-w-[160px] ml-3">
              <span className="truncate font-semibold">Create Workspace</span>
              <span className="truncate text-xs text-gray-500">You don't have any workspaces yet</span>
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
                  {activeWorkspace.name.charAt(0).toUpperCase()}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight max-w-[160px] ml-3">
                  <span className="truncate font-semibold">
                    {activeWorkspace.name}
                  </span>
                  <span className="truncate text-xs text-gray-500 capitalize">{activeWorkspace.role}</span>
                </div>
                <div className="relative ml-auto">
                  {totalPendingCount > 0 && (
                    <span className="absolute -left-1 -top-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white shadow-sm ring-1 ring-white dark:ring-gray-800">
                      {totalPendingCount}
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
                WORKSPACES
              </DropdownMenuLabel>
              
              {/* Current workspace first with settings button */}
              {activeWorkspace && (
                <DropdownMenuItem
                  key={`active-${activeWorkspace.id}`}
                  className="flex items-center justify-center gap-2 py-1.5 px-3 cursor-pointer bg-violet-100 dark:bg-violet-900/20 hover:bg-violet-200 dark:hover:bg-violet-900/30 rounded-xl mb-1"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border-0 bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-300 font-medium">
                        {activeWorkspace.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="max-w-[140px]">
                        <p className="text-sm font-medium truncate">{activeWorkspace.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{activeWorkspace.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Settings 
                        className="h-4 w-4 text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300" 
                        onClick={(e) => handleWorkspaceSettings(e, activeWorkspace.id)}
                      />
                    </div>
                  </div>
                </DropdownMenuItem>
              )}
              
              {/* Other active workspaces */}
              {activeWorkspaces
                .filter(ws => ws.id !== activeWorkspace?.id)
                .map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={(e) => {
                      e.preventDefault();
                      // Show loading state
                      const target = e.currentTarget;
                      target.classList.add('opacity-50', 'pointer-events-none');
                      
                      console.log('Switching to workspace:', ws.name);
                      
                      // Call the async function with proper error handling
                      switchWorkspace(ws)
                        .catch((error) => {
                          console.error('Error switching workspace:', error);
                          // Remove loading indicator if there's an error
                          target.classList.remove('opacity-50', 'pointer-events-none');
                        });
                    }}
                    className="flex items-center justify-center gap-2 py-1.5 px-3 cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl border-0 bg-gray-100 dark:bg-gray-800 text-violet-600 dark:text-violet-400 font-medium">
                          {ws.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="max-w-[140px]">
                          <p className="text-sm font-medium truncate">{ws.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{ws.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <ChevronRight className="h-4 w-4 text-violet-600/70 dark:text-violet-400/70" />
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}

              {/* Invitations section - both pending workspaces and direct invitations */}
              {(pendingWorkspaces.length > 0 || incomingInvitations.length > 0) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground mb-1 flex items-center">
                    <Bell className="h-3 w-3 mr-1 text-red-500" /> PENDING INVITATIONS
                    {totalPendingCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-medium dark:bg-red-900/30 dark:text-red-400">
                        {totalPendingCount}
                      </span>
                    )}
                  </DropdownMenuLabel>
                  
                  {/* Combined invitations list with accordion behavior */}
                  {getAllPendingItems()
                    .slice(0, showAllInvitations ? undefined : MAX_VISIBLE_INVITATIONS)
                    .map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        className="flex items-center justify-center gap-2 py-1.5 px-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl mb-1"
                        onSelect={(e) => {
                          // Prevent the dropdown from closing when selecting this item
                          e.preventDefault();
                          handleInvitationClick(item.id);
                        }}
                      >
                        <div className="flex flex-col w-full">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-xl border-0 
                                ${item.type === 'direct' 
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'} font-medium`}
                              >
                                {item.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="max-w-[140px]">
                                <p className="text-sm font-medium truncate">{item.name}</p>
                                {item.type === 'direct' ? (
                                  <p className="text-xs text-gray-500 truncate">
                                    Invited as {item.role}
                                  </p>
                                ) : (
                                  <div className="flex items-center">
                                    <Clock className="h-3 w-3 mr-1 text-yellow-500" />
                                    <p className="text-xs text-yellow-500">Pending approval</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center">
                              <ChevronRight 
                                className={`h-4 w-4 text-muted-foreground transition-transform ${expandedInvitationId === item.id ? 'rotate-90' : ''}`}
                              />
                            </div>
                          </div>
                          
                          {/* Expanded section with accept/decline buttons */}
                          {expandedInvitationId === item.id && item.invitation && (
                            <div className="ml-11 mt-2 flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                                className="h-6 px-2 text-xs rounded-xl border-0 bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                  const invitationId = item.invitation?.id;
                                  if (!invitationId) return;
                                  
                                  console.log(`Accepting invitation ${invitationId}`);
                                  acceptInvitation(invitationId)
                                  .then(() => {
                                    console.log('Invitation accepted successfully');
                                      setExpandedInvitationId(null);
                                      // Refresh the workspaces data
                                      refreshWorkspaces();
                                      // Reload the page to ensure all contexts are updated
                                      window.location.reload();
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
                                className="h-6 px-2 text-xs rounded-xl border-0 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                  const invitationId = item.invitation?.id;
                                  if (!invitationId) return;
                                  
                                  console.log(`Rejecting invitation ${invitationId}`);
                                  rejectInvitation(invitationId)
                                  .then(() => {
                                    console.log('Invitation rejected successfully');
                                      setExpandedInvitationId(null);
                                  })
                                    .catch((err: Error) => {
                                    console.error('Error rejecting invitation:', err);
                                  });
                              }}
                            >
                              Decline
                            </Button>
                          </div>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}

                  {/* Show more/less button when there are more than MAX_VISIBLE_INVITATIONS */}
                  {totalPendingCount > MAX_VISIBLE_INVITATIONS && (
                    <div 
                      className="flex justify-center py-1 my-1 text-xs text-primary cursor-pointer hover:underline"
                      onClick={() => {
                        setShowAllInvitations(!showAllInvitations);
                        // Reset expanded invitation when toggling show all
                        setExpandedInvitationId(null);
                      }}
                    >
                      {showAllInvitations 
                        ? "Show less invitations" 
                        : `Show ${totalPendingCount - MAX_VISIBLE_INVITATIONS} more invitation${totalPendingCount - MAX_VISIBLE_INVITATIONS > 1 ? 's' : ''}`
                      }
                    </div>
                  )}
                </>
              )}
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                className="flex items-center justify-center gap-2 py-1.5 px-3 cursor-pointer rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={handleCreateWorkspace}
              >
                <div className="flex size-8 items-center justify-center rounded-xl border-0 bg-gray-100 dark:bg-gray-800 text-violet-600 dark:text-violet-400">
                  <Plus className="size-3.5" />
                </div>
                <div className="font-medium text-sm truncate">Create workspace</div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateWorkspaceModal 
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={refreshWorkspaces}
      />
    </>
  )
}
