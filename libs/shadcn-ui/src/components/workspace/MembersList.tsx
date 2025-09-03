"use client"

import * as React from "react"
import { Mail, User, UserPlus, Shield, Clock, Trash2, Check, X, ChevronDown, LogOut, UserMinus, Crown, Loader2 } from "lucide-react"
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
import { useWorkspace } from '../../../../../apps/frontend/src/utils/workspaceContext'
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

interface MembersListProps {
  workspaceId?: string;
}

export interface MembersListHandle {
  refreshMembers: () => void;
}

export const MembersList = React.forwardRef<MembersListHandle, MembersListProps>(({ workspaceId }, ref) => {
  const {
    activeWorkspace,
    refreshWorkspaces,
  } = useWorkspace()
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

  const targetWorkspaceId = workspaceId || activeWorkspace?.id

  const userRole = activeWorkspace?.role
  const isOwner = userRole === 'owner'
  const canInviteMembers = isOwner || userRole === 'admin'

  const getMemberName = (member: Member) => {
    if (member.user?.fullName) return member.user.fullName
    if (member.user?.firstName && member.user?.lastName)
      return `${member.user.firstName} ${member.user.lastName}`
    if (member.user?.firstName) return member.user.firstName
    return "Jibu ai user"
  }

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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />
      default:
        return <User className="h-4 w-4" />
    }
  }

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

  const canChangeRole = (member: Member) => {
    if (member.role === 'owner') return false;
    if (member.email === currentUserEmail) return false;
    return userRole === 'owner';
  }

  const getAvailableRoles = () => {
    if (userRole === 'owner') {
      return ['admin', 'editor'];
    }
    return [];
  }

  const canDeleteMember = (member: Member) => {
    const isCurrentUser = member.email === currentUserEmail;
    if (isCurrentUser) return false;
    if (member.role === 'owner') return false;
    if (userRole === 'owner') return member.role !== 'owner';
    if (userRole === 'admin') return member.role === 'editor';
    return false;
  }

  const canLeaveWorkspace = () => {
    return userRole !== 'owner';
  }
  
  const getEligibleNewOwners = () => {
      return members.filter(m => m.role === 'admin');
  }

  const sortMembersWithCurrentUserFirst = React.useCallback((membersList: Member[]) => {
    const isCurrentUser = (member: Member) => member.email === currentUserEmail;

    return [...membersList].sort((a, b) => {
      if (isCurrentUser(a)) return -1;
      if (isCurrentUser(b)) return 1;

      const roleOrder: Record<string, number> = { owner: 0, admin: 1, editor: 2 };
      if (a.role !== b.role) {
        return (roleOrder[a.role] || 999) - (roleOrder[b.role] || 999);
      }

      return a.email.localeCompare(b.email);
    });
  }, [currentUserEmail]);

  const fetchMembers = React.useCallback(async () => {
    if (!targetWorkspaceId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchAPI(`/workspaces/${targetWorkspaceId}/members`);
      setMembers(sortMembersWithCurrentUserFirst(data));
    } catch (err) {
      console.error('Error fetching members:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch members');
    } finally {
      setIsLoading(false);
    }
  }, [targetWorkspaceId, sortMembersWithCurrentUserFirst]);

  React.useEffect(() => {
    if (currentUserEmail) {
      fetchMembers();
    }
  }, [fetchMembers, currentUserEmail]);

  const refreshMembers = React.useCallback(() => {
    fetchMembers();
  }, [fetchMembers]);

  React.useImperativeHandle(ref, () => ({
    refreshMembers,
  }));

  const deleteMember = async () => {
    if (!memberToDelete) return;

    try {
      setIsDeleting(true);
      await fetchAPI(`/workspaces/${targetWorkspaceId}/members/${memberToDelete.id}`, { method: 'DELETE' });

      toast({ title: "Member removed", description: `${memberToDelete.email} has been removed.` });

      refreshMembers();
      if (refreshWorkspaces) refreshWorkspaces();
    } catch (err) {
      console.error('Error deleting member:', err);
      toast({ title: "Error", description: "Failed to remove member.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setMemberToDelete(null);
    }
  }

  const leaveWorkspace = async () => {
      if (!currentUserEmail) return;
      const currentUserMember = members.find(m => m.email === currentUserEmail);
      if (!currentUserMember) return;

    try {
      setIsDeleting(true);
      await fetchAPI(`/workspaces/${targetWorkspaceId}/members/${currentUserMember.id}`, { method: 'DELETE' });

      toast({ title: "Left workspace", description: "You have left the workspace." });

      if (refreshWorkspaces) await refreshWorkspaces();
      
      // Redirect logic
      if (typeof window !== 'undefined') {
          localStorage.removeItem('activeWorkspaceId');
          window.location.href = '/';
      }

    } catch (err) {
      console.error('Error leaving workspace:', err);
      toast({ title: "Error", description: "Failed to leave workspace.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setIsLeaveDialogOpen(false);
    }
  };

  const changeMemberRole = async (memberId: string, newRole: string) => {
    try {
      await fetchAPI(`/workspaces/${targetWorkspaceId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      toast({ title: 'Role updated', description: `Role updated to ${newRole}.` });
      refreshMembers();
    } catch (err) {
      console.error('Error updating member role:', err);
      toast({ title: 'Error', description: 'Failed to update role.', variant: 'destructive' });
    }
  };

  const transferOwnership = async () => {
    if (!newOwnerId) return;

    try {
      setIsTransferring(true);
      await fetchAPI(`/workspaces/${targetWorkspaceId}/transfer-ownership`, {
        method: 'POST',
        body: JSON.stringify({ newOwnerId }),
      });
      toast({ title: 'Ownership Transferred', description: 'You are no longer the owner.' });
      if (refreshWorkspaces) await refreshWorkspaces();
      setIsTransferDialogOpen(false);
      refreshMembers();
    } catch (err) {
      console.error('Error transferring ownership:', err);
      toast({ title: 'Error', description: 'Failed to transfer ownership.', variant: 'destructive' });
    } finally {
      setIsTransferring(false);
    }
  };

  if (isLoading && members.length === 0) {
    return <div>Loading members...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <>
      <CustomCard>
        <CustomCardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Workspace Members</CardTitle>
            <CardDescription>Manage members and their roles.</CardDescription>
          </div>
          {canInviteMembers && (
            <Button onClick={() => setIsInviteModalOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Members
            </Button>
          )}
        </CustomCardHeader>
        <CustomCardContent>
          <div className="space-y-4">
            {members.map((member) => {
              const isCurrentUser = member.email === currentUserEmail;
              return (
                <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                      <User className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {getMemberName(member)}
                        {isCurrentUser && <span className="text-xs text-muted-foreground">(You)</span>}
                      </p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm flex items-center gap-1 capitalize">
                      {canChangeRole(member) ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 px-2 flex items-center gap-1 capitalize">
                              {getRoleIcon(member.role)} {member.role} <ChevronDown className="h-3 w-3 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40 rounded-xl">
                            {getAvailableRoles().map((role) => (
                              <DropdownMenuItem key={role} className="capitalize" onClick={() => changeMemberRole(member.id, role)}>
                                {getRoleIcon(role)} {role}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <div className="flex items-center gap-1 capitalize">
                          {getRoleIcon(member.role)} {member.role}
                        </div>
                      )}
                    </div>
                    <div className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusBadgeClass(member.status)}`}>
                      {member.status}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl">
                        {canDeleteMember(member) && (
                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => { setMemberToDelete(member); setIsDeleteDialogOpen(true); }}>
                            <UserMinus className="mr-2 h-4 w-4" />
                            Remove Member
                          </DropdownMenuItem>
                        )}
                        {isCurrentUser && canLeaveWorkspace() && (
                          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setIsLeaveDialogOpen(true)} >
                            <LogOut className="mr-2 h-4 w-4" />
                            Leave Workspace
                          </DropdownMenuItem>
                        )}
                        {isCurrentUser && isOwner && (
                          <DropdownMenuItem onClick={() => setIsTransferDialogOpen(true)}>
                            <Crown className="mr-2 h-4 w-4" />
                            Transfer Ownership
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </CustomCardContent>
      </CustomCard>

      <InviteMembers
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          refreshMembers();
        }}
        workspaceId={targetWorkspaceId}
      />

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>This will permanently remove <strong>{memberToDelete?.email}</strong> from the workspace.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteMember} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Workspace?</DialogTitle>
            <DialogDescription>Are you sure you want to leave? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsLeaveDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={leaveWorkspace} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Ownership</DialogTitle>
            <DialogDescription>Select a new owner. This will make you an admin.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select onValueChange={setNewOwnerId} value={newOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select new owner..." />
              </SelectTrigger>
              <SelectContent>
                {getEligibleNewOwners().map(admin => (
                  <SelectItem key={admin.id} value={admin.id}>{getMemberName(admin)} ({admin.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsTransferDialogOpen(false)}>Cancel</Button>
            <Button onClick={transferOwnership} disabled={isTransferring || !newOwnerId}>
              {isTransferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

MembersList.displayName = "MembersList";

export default MembersList;