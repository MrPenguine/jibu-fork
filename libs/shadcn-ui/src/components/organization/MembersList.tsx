"use client"

import * as React from "react"
import { Mail, User, UserPlus, Shield, Clock, Trash2, Check, X, ChevronDown } from "lucide-react"
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

interface MembersListProps {
  organizationId?: string
}

export function MembersList({ organizationId }: MembersListProps) {
  const { activeOrganization } = useOrganization()
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false)
  const [members, setMembers] = React.useState<Member[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [memberToDelete, setMemberToDelete] = React.useState<Member | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  
  // Get organization ID from props or active organization
  const targetOrgId = organizationId || activeOrganization?.id
  
  // Check user permissions based on role
  const userRole = activeOrganization?.role
  const canInviteMembers = userRole === 'owner' || userRole === 'admin'
  const canDeleteMembers = userRole === 'owner' || userRole === 'admin'
  const canChangeRoles = userRole === 'owner' || userRole === 'admin'
  
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

  // Check if user can delete a specific member
  const canDeleteMember = (member: Member) => {
    // Owner can delete anyone except themselves
    if (userRole === 'owner') {
      return member.email !== activeOrganization?.email
    }
    // Admin can delete everyone except owners and themselves
    if (userRole === 'admin') {
      return member.role !== 'owner' && member.email !== activeOrganization?.email
    }
    // Editors cannot delete anyone
    return false
  }

  // Check if user can change role of a specific member
  const canChangeRole = (member: Member) => {
    // Owner can change role of anyone except themselves
    if (userRole === 'owner') {
      return member.email !== activeOrganization?.email
    }
    // Admin can change role of editors only
    if (userRole === 'admin') {
      return member.role !== 'owner' && member.role !== 'admin' && member.email !== activeOrganization?.email
    }
    // Editors cannot change roles
    return false
  }

  // Get available roles for changing based on current user role
  const getAvailableRoles = (member: Member) => {
    if (userRole === 'owner') {
      return ['owner', 'admin', 'editor']
    }
    if (userRole === 'admin') {
      return ['admin', 'editor']
    }
    return []
  }

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
        setMembers(data)
      } catch (err) {
        console.error('Error fetching members:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch members')
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchMembers()
  }, [targetOrgId])
  
  // Function to refresh members list
  const refreshMembers = () => {
    setIsLoading(true)
    fetchAPI(`/organizations/${targetOrgId}/members`)
      .then(data => {
        setMembers(data)
        setIsLoading(false)
      })
      .catch(err => {
        console.error('Error refreshing members:', err)
        setError(err instanceof Error ? err.message : 'Failed to refresh members')
        setIsLoading(false)
      })
  }
  
  // Function to delete a member
  const deleteMember = async () => {
    if (!memberToDelete) return

    try {
      setIsDeleting(true)
      await fetchAPI(`/organizations/${targetOrgId}/members/${memberToDelete.id}`, {
        method: 'DELETE'
      })
      
      toast({
        title: "Member removed",
        description: `${memberToDelete.email} has been removed from the organization.`,
      })
      refreshMembers()
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
  
  // Function to change member role
  const changeMemberRole = async (memberId: string, newRole: string) => {
    try {
      await fetchAPI(`/organizations/${targetOrgId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      })
      
      toast({
        title: "Role updated",
        description: `Member role has been updated to ${newRole}.`,
      })
      refreshMembers()
    } catch (err) {
      console.error('Error updating role:', err)
      toast({
        title: "Error",
        description: "Failed to update role. Please try again.",
        variant: "destructive"
      })
    }
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
            <Button 
              onClick={() => setIsInviteModalOpen(true)}
              className="ml-auto rounded-xl"
              disabled={!canInviteMembers}
              title={!canInviteMembers ? "Only owners and admins can invite members" : ""}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Members
            </Button>
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
                      const isCurrentUser = member.email === activeOrganization?.email;
                      
                      return (
                        <div 
                          key={member.id} 
                          className={`px-6 py-4 grid grid-cols-5 gap-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                            isCurrentUser ? "bg-violet-50/30 dark:bg-violet-900/10" : ""
                          }`}
                        >
                          <div className="text-sm flex items-center gap-2">
                            {member.email}
                            {isCurrentUser && (
                              <span className="text-xs bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 py-0.5 px-2 rounded-full">
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
                              <>
                                {getRoleIcon(member.role)} {member.role}
                              </>
                            )}
                          </div>
                          <div className="text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(member.status)}`}>
                              {member.status}
                            </span>
                          </div>
                          {(canDeleteMembers || canChangeRoles) && (
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
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
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
            <DialogTitle>Remove member</DialogTitle>
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
    </div>
  )
} 