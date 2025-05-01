"use client"

import * as React from "react"
import { Mail, User, UserPlus, Shield, Clock, Trash2, Check, X, ChevronDown, LogOut, UserMinus, Crown } from "lucide-react"
import { 
  CardDescription, 
  CardTitle, 
  CustomCard, 
  CustomCardContent, 
  CustomCardHeader 
} from "@libs/shadcn-ui/components/ui/custom-card"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { InviteMembers } from "./InviteMembers"
import { fetchAPI } from '../../../../../apps/frontend/src/utils/api'
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@libs/shadcn-ui/components/ui/dropdown-menu"
import { toast } from "@libs/shadcn-ui/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@libs/shadcn-ui/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@libs/shadcn-ui/components/ui/select"

interface MemberUser {
  id?: string
  email?: string
  firstName?: string
  lastName?: string
  fullName?: string
  imageUrl?: string
}

interface Member {
  id: string
  email: string
  role: string
  status: string
  userId?: string
  user?: MemberUser
  createdAt: string
  updatedAt: string
}

interface Invitation {
  id: string;
  email?: string;
  role?: string;
  status?: string;
  organization?: {
    id: string;
    name?: string;
    email?: string;
  };
}

interface MembersListProps {
  organizationId?: string
}

export function MembersList({ organizationId }: MembersListProps) {
  const { 
    activeOrganization, 
    refreshOrganizations, 
    incomingInvitations = [], 
    rejectInvitation 
  } = useOrganization()
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false)
  const [members, setMembers] = React.useState<Member[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [memberToDelete, setMemberToDelete] = React.useState<Member | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = React.useState(false)
  const [isTransferDialogOpen, setIsTransferDialogOpen] = React.useState(false)
  const [newOwnerId, setNewOwnerId] = React.useState<string>('')
  const [isTransferring, setIsTransferring] = React.useState(false)
  const [currentUserEmail, setCurrentUserEmail] = React.useState<string | null>(null)
  
  // Get organization ID from props or active organization
  const targetOrgId = organizationId || activeOrganization?.id
  
  // Check user permissions based on role
  const userRole = activeOrganization?.role
  const isOwner = userRole === 'owner'
  const canInviteMembers = isOwner || userRole === 'admin'
  const canDeleteMembers = isOwner || userRole === 'admin'
  const canChangeRoles = isOwner || userRole === 'admin'
  
  // Function to get member display name
  const getMemberName = (member: Member) => {
    if (member.user?.fullName) return member.user.fullName
    if (member.user?.firstName && member.user?.lastName) 
      return `${member.user.firstName} ${member.user.lastName}`
    if (member.user?.firstName) return member.user.firstName
    return "Jibu ai user"
  }
  
  // Function to get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }
  
  // Function to get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Shield className="h-4 w-4 text-purple-600" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  // Fetch current user's data when component mounts
  React.useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const userData = await fetchAPI('/users/me');
        if (userData && userData.email) {
          setCurrentUserEmail(userData.email);
        }
      } catch (err) {
        console.error('Error fetching current user data:', err);
      }
    };
    
    fetchCurrentUser();
  }, []);

  // Check if user can change role of a specific member
  const canChangeRole = (member: Member) => {
    // No one can change the owner role
    if (member.role === 'owner') {
      return false;
    }
    
    // Current user cannot change their own role
    if (member.email === activeOrganization?.email) {
      return false;
    }
    
    // Only owners can change roles
    return userRole === 'owner';
  }

  // Get available roles for changing based on current user role
  const getAvailableRoles = (member: Member) => {
    if (userRole === 'owner') {
      // Owner can only assign admin or editor roles (can't create another owner)
      return ['admin', 'editor'];
    }
    
    // Admins and others cannot change roles
    return [];
  }

  // Check if user can delete a specific member
  const canDeleteMember = (member: Member) => {
    const isCurrentUser = member.email === activeOrganization?.email;
    
    // Current user cannot delete themselves (should use leave instead)
    if (isCurrentUser) {
      return false;
    }
    
    // Owner cannot be removed by anyone
    if (member.role === 'owner') {
      return false;
    }
    
    // Cannot remove members with pending status - should wait for them to accept/reject
    if (member.status === 'pending') {
      return false;
    }
    
    // Owner can delete anyone except owners
    if (userRole === 'owner') {
      return member.role !== 'owner';
    }
    
    // Admin can delete editors only, not other admins or owners
    if (userRole === 'admin') {
      return member.role === 'editor';
    }
    
    // Editors cannot delete anyone
    return false;
  }

  // Check if the current user can leave the organization
  const canLeaveOrganization = () => {
    // Owners can't leave directly (they must transfer ownership first)
    return userRole !== 'owner';
  }

  // Function to sort members list so current user is first
  const sortMembersWithCurrentUserFirst = (membersList: Member[]) => {
    return [...membersList].sort((a, b) => {
      // Current user comes first
      if (isCurrentUser(a)) return -1;
      if (isCurrentUser(b)) return 1;
      
      // Then sort by role (owner first, then admin, then editor)
      if (a.role !== b.role) {
        const roleOrder: Record<string, number> = { 
          owner: 0, 
          admin: 1, 
          editor: 2 
        };
        return (roleOrder[a.role] || 999) - (roleOrder[b.role] || 999);
      }
      
      // Then sort alphabetically by email
      return a.email.localeCompare(b.email);
    });
  };

  // Fetch members when component mounts
  React.useEffect(() => {
    const fetchMembers = async () => {
      if (!targetOrgId) {
        setIsLoading(false)
        return
      }
      
      try {
        setIsLoading(true)
        setError(null)
        
        const data = await fetchAPI(`/organizations/${targetOrgId}/members`)
        // Sort the members to ensure current user is first
        setMembers(sortMembersWithCurrentUserFirst(data))
      } catch (err) {
        console.error('Error fetching members:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch members')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchMembers()
  }, [targetOrgId, currentUserEmail])
  
  // Function to refresh members list
  const refreshMembers = () => {
    setIsLoading(true)
    fetchAPI(`/organizations/${targetOrgId}/members`)
      .then(data => {
        // Sort the members to ensure current user is first
        setMembers(sortMembersWithCurrentUserFirst(data))
        setIsLoading(false)
      })
      .catch(err => {
        console.error('Error refreshing members:', err)
        setError(err instanceof Error ? err.message : 'Failed to refresh members')
        setIsLoading(false)
      })
  }
  
  // Function to delete a member and any associated pending invitations
  const deleteMember = async () => {
    if (!memberToDelete) return

    try {
      setIsDeleting(true)
      
      // First delete the member from the organization
      await fetchAPI(`/organizations/${targetOrgId}/members/${memberToDelete.id}`, {
        method: 'DELETE'
      })
      
      // Let's also check for and delete any pending invitations for this email
      try {
        // First, get all pending invitations for this organization
        const orgInvitations = await fetchAPI(`/organizations/${targetOrgId}/invitations`);
        
        // Filter to find any that match the email of the member being deleted
        const matchingInvitations = orgInvitations.filter((invite: any) => 
          invite.email?.toLowerCase() === memberToDelete.email.toLowerCase()
        );
        
        if (matchingInvitations.length > 0) {
          console.log(`Found ${matchingInvitations.length} pending invitations for ${memberToDelete.email}`);
          
          // Delete each invitation directly through the API
          for (const invitation of matchingInvitations) {
            try {
              // Call the reject invitation endpoint directly
              await fetchAPI(`/organizations/${targetOrgId}/invitations/${invitation.id}/reject`, {
                method: 'POST'
              });
              console.log(`Deleted invitation ${invitation.id} for ${memberToDelete.email}`);
            } catch (inviteErr) {
              console.error(`Error deleting invitation ${invitation.id}:`, inviteErr);
            }
          }
        }
      } catch (inviteListErr) {
        console.error('Error fetching or processing invitations:', inviteListErr);
        // Continue with the process even if this part fails
      }
      
      toast({
        title: "Member removed",
        description: `${memberToDelete.email} has been removed from the organization.`,
      })
      
      // Refresh both members list and organization data to ensure UI is up-to-date
      refreshMembers()
      refreshOrganizations()
    } catch (err) {
      console.error('Error deleting member:', err)
      toast({
        title: "Error",
        description: "Failed to remove member. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
      setMemberToDelete(null)
    }
  }
  
  // Function to leave the organization
  const leaveOrganization = async (member: Member) => {
    try {
      setIsDeleting(true);
      
      // Delete the membership
      await fetchAPI(`/organizations/${targetOrgId}/members/${member.id}`, {
        method: 'DELETE'
      });
      
      toast({
        title: "Left organization",
        description: "You have left the organization successfully.",
      });
      
      // Update localStorage to remove this org as active
      try {
        localStorage.removeItem('activeOrganizationId');
      } catch (err) {
        console.error('Error updating localStorage:', err);
      }
      
      // Fetch user's remaining organizations
      const remainingOrgs = await fetchAPI('/organizations');
      
      if (remainingOrgs && remainingOrgs.length > 0) {
        // Set the first available org as the active one
        const newActiveOrg = remainingOrgs[0];
        
        try {
          // Store the new active org ID
          localStorage.setItem('activeOrganizationId', newActiveOrg.id);
        } catch (err) {
          console.error('Error updating localStorage:', err);
        }
        
        // Redirect to the dashboard with the new org
        window.location.href = '/';
      } else {
        // If no organizations left, redirect to the organizations page
        // where they can create a new one
        window.location.href = '/organizations';
      }
    } catch (err) {
      console.error('Error leaving organization:', err);
      toast({
        title: "Error",
        description: "Failed to leave the organization. Please try again.",
        variant: "destructive"
      });
      setIsDeleting(false);
      setIsLeaveDialogOpen(false);
    }
  }
  
  // Function to change member role
  const changeMemberRole = async (memberId: string, newRole: string) => {
    try {
      await fetchAPI(`/organizations/${targetOrgId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      });
      
      toast({
        title: "Role updated",
        description: `Member role has been updated to ${newRole}.`,
      });
      refreshMembers();
    } catch (err) {
      console.error('Error updating role:', err);
      
      // Check for specific error messages
      const errorMessage = err instanceof Error ? err.message : 'Failed to update role';
      
      if (errorMessage.includes("Admins can only assign the editor role")) {
        toast({
          title: "Permission Denied",
          description: "Admins can only assign the editor role to other members.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update role. Please try again.",
          variant: "destructive"
        });
      }
    }
  }
  
  // Function to transfer ownership to another member
  const transferOwnership = async () => {
    if (!newOwnerId || !targetOrgId) return;
    
    try {
      setIsTransferring(true);
      
      await fetchAPI(`/organizations/${targetOrgId}/transfer-ownership`, {
        method: 'POST',
        body: JSON.stringify({ newOwnerId })
      });
      
      toast({
        title: "Ownership transferred",
        description: "Organization ownership has been transferred successfully.",
      });
      
      refreshMembers();
      setIsTransferDialogOpen(false);
    } catch (err) {
      console.error('Error transferring ownership:', err);
      toast({
        title: "Error",
        description: "Failed to transfer ownership. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsTransferring(false);
    }
  };

  // Get eligible members who can become owners (active members who aren't the current owner)
  const getEligibleNewOwners = () => {
    return members.filter(member => 
      member.status === 'active' && 
      member.email !== activeOrganization?.email
    );
  };
  
  // Add isCurrentUser function
  // Function to check if this is the current user
  const isCurrentUser = (member: Member) => {
    // Try to match by comparing with the user's email from /users/me API
    // If that's not available, fall back to the activeOrganization.email
    return (
      (currentUserEmail && member.email === currentUserEmail) || 
      member.email === activeOrganization?.email
    );
  }

  return (
    <div className="flex justify-center">
      <div className="w-full md:w-5/6">
        <CustomCard className="p-0 overflow-hidden">
          <CustomCardHeader className="p-6 pb-3 flex flex-row justify-between items-start">
            <div>
              <CardTitle>Organization Members</CardTitle>
              <CardDescription>
                Members who have access to this organization
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isOwner ? (
                <Button 
                  onClick={() => setIsTransferDialogOpen(true)}
                  className="rounded-xl bg-purple-600 hover:bg-purple-700"
                  title="Transfer ownership to another member"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Transfer Ownership
                </Button>
              ) : (
                <Button 
                  onClick={() => {
                    // Find the current user's membership
                    const currentMember = members.find(m => isCurrentUser(m));
                    if (currentMember) {
                      setMemberToDelete(currentMember);
                      setIsLeaveDialogOpen(true);
                    }
                  }}
                  className="rounded-xl bg-orange-600 hover:bg-orange-700"
                  title="Leave this organization"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave Organization
                </Button>
              )}
              
            </div>
          </CustomCardHeader>
          <CustomCardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full mb-4"></div>
                  <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-500">
                Error: {error}
              </div>
            ) : (
              <>
                <div className="px-6 py-4 grid grid-cols-5 gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" /> Email
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" /> Name
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4" /> Role
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" /> Status
                  </div>
                  {(canDeleteMembers || canChangeRoles) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      Actions
                    </div>
                  )}
                </div>
                
                <div className="h-px w-full bg-border" />
                
                {members.length > 0 ? (
                  <div>
                    {members.map((member) => {
                      // Check if this is the current user
                      const currentUser = isCurrentUser(member);
                      
                      return (
                        <div 
                          key={member.id} 
                          className={`px-6 py-4 grid grid-cols-5 gap-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                            currentUser ? "bg-violet-100 dark:bg-violet-900/30 relative" : ""
                          }`}
                        >
                          <div className="text-sm flex items-center gap-2 font-medium">
                            {member.email}
                            {currentUser && (
                              <span className="ml-1 text-xs font-bold bg-violet-200 text-violet-800 dark:bg-violet-800 dark:text-violet-200 py-0.5 px-2 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-sm">{getMemberName(member)}</div>
                          <div className="text-sm flex items-center gap-1 capitalize">
                            {canChangeRole(member) ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 px-2 flex items-center gap-1 capitalize">
                                    {getRoleIcon(member.role)} {member.role} <ChevronDown className="h-3 w-3 ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-40 rounded-xl">
                                  {getAvailableRoles(member).map((role) => (
                                    <DropdownMenuItem 
                                      key={role}
                                      className="capitalize"
                                      onClick={() => changeMemberRole(member.id, role)}
                                    >
                                      {getRoleIcon(role)} <span className="ml-2">{role}</span>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${
                                member.role === 'owner' ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                              }`}>
                                {getRoleIcon(member.role)} <span>{member.role}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(member.status)}`}>
                              {member.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {canDeleteMember(member) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                                onClick={() => {
                                  setMemberToDelete(member);
                                  setIsDeleteDialogOpen(true);
                                }}
                                title="Remove member"
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {currentUser && (
                              <>
                                {isOwner ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-3 text-purple-500 hover:text-purple-700 hover:bg-purple-100"
                                    onClick={() => {
                                      setIsTransferDialogOpen(true);
                                      setNewOwnerId('');
                                    }}
                                    title="Transfer ownership to another member"
                                  >
                                    <Crown className="h-4 w-4 mr-1" /> Transfer
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-3 text-orange-500 hover:text-orange-700 hover:bg-orange-100"
                                    onClick={() => {
                                      setMemberToDelete(member);
                                      setIsLeaveDialogOpen(true);
                                    }}
                                    title="Leave this organization"
                                  >
                                    <LogOut className="h-4 w-4 mr-1" /> Leave
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    No members found
                  </div>
                )}
              </>
            )}
          </CustomCardContent>
        </CustomCard>
      </div>
      
      <InviteMembers 
        isOpen={isInviteModalOpen} 
        onClose={() => {
          setIsInviteModalOpen(false)
          refreshMembers()
        }}
        organizationId={targetOrgId}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {memberToDelete?.email} from this organization? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={deleteMember}
              disabled={isDeleting}
            >
              {isDeleting ? "Removing..." : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Leave Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave this organization? You will lose access to all resources and content.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsLeaveDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => memberToDelete && leaveOrganization(memberToDelete)}
              disabled={isDeleting}
            >
              {isDeleting ? "Leaving..." : "Leave Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Transfer Ownership</DialogTitle>
            <DialogDescription>
              Select a member to transfer ownership to. You will be demoted to an admin role.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-1.5 mb-4">
              <label htmlFor="new-owner" className="text-sm font-medium">
                New Owner
              </label>
              <Select value={newOwnerId} onValueChange={setNewOwnerId}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {getEligibleNewOwners().map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.email}</span>
                        <span className="text-xs text-muted-foreground">({member.role})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30 text-sm text-amber-800 dark:text-amber-300">
              <p className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-amber-500 dark:text-amber-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                This action cannot be undone. The new owner will have full control over this organization.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsTransferDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="rounded-xl bg-purple-600 hover:bg-purple-700"
              onClick={transferOwnership}
              disabled={isTransferring || !newOwnerId}
            >
              {isTransferring ? "Transferring..." : "Transfer Ownership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 