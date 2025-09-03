"use client"

import * as React from "react"
import { Mail, Clock, Trash2, Send } from "lucide-react"
import { 
  CardDescription, 
  CardTitle, 
  CustomCard, 
  CustomCardContent, 
  CustomCardHeader 
} from "@libs/shadcn-ui/components/ui/custom-card"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { fetchAPI } from '../../../../../apps/frontend/src/utils/api'
import { useWorkspace } from '../../../../../apps/frontend/src/utils/workspaceContext'
import { toast } from "@libs/shadcn-ui/components/ui/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@libs/shadcn-ui/components/ui/tooltip"

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

interface PendingInvitationsProps {
  workspaceId: string;
  refreshMembers: () => void;
}

export function PendingInvitations({ workspaceId, refreshMembers }: PendingInvitationsProps) {
  const { activeWorkspace } = useWorkspace()
  const [invitations, setInvitations] = React.useState<Invitation[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const userRole = activeWorkspace?.role
  const canManageInvites = userRole === 'owner' || userRole === 'admin'

  const fetchInvitations = React.useCallback(async () => {
    if (!workspaceId) {
      setIsLoading(false)
      return
    }
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await fetchAPI(`/v1/invitations/workspace/${workspaceId}`)
      setInvitations(data)
    } catch (err) {
      console.error('Error fetching invitations:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch invitations')
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId])

  React.useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])

  const cancelInvitation = async (invitationId: string) => {
    if (!canManageInvites) return;

    try {
      await fetchAPI(`/workspaces/invitations/${invitationId}/revoke`, {
        method: 'POST'
      })
      toast({ title: "Invitation cancelled", description: "The invitation has been successfully cancelled." })
      fetchInvitations() // Refresh the list of invitations
      refreshMembers() // Refresh the main members list as well
    } catch (err) {
      console.error('Error cancelling invitation:', err)
      toast({ title: "Error", description: "Failed to cancel invitation.", variant: "destructive" })
    }
  }

  const resendInvitation = async (invitationId: string) => {
    if (!canManageInvites) return;

    try {
      await fetchAPI(`/workspaces/invitations/${invitationId}/resend`, {
        method: 'POST'
      });
      toast({ title: "Invitation resent", description: "The invitation has been sent again." });
      fetchInvitations();
    } catch (err) {
      console.error('Error resending invitation:', err);
      toast({ title: "Error", description: "Failed to resend invitation.", variant: "destructive" });
    }
  }

  if (isLoading) {
    return <div>Loading pending invitations...</div>
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>
  }

  if (invitations.length === 0) {
    return null // Don't render anything if there are no pending invites
  }

  return (
    <CustomCard className="mb-8">
      <CustomCardHeader>
        <CardTitle>Pending Invitations</CardTitle>
        <CardDescription>These users have been invited but have not yet joined.</CardDescription>
      </CustomCardHeader>
      <CustomCardContent>
        <div className="space-y-4">
          {invitations.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                  <Mail className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-sm text-muted-foreground">Invited as {invite.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(invite.createdAt).toLocaleDateString()}
                </span>
                {canManageInvites && (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => resendInvitation(invite.id)}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Resend Invitation</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => cancelInvitation(invite.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Cancel Invitation</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CustomCardContent>
    </CustomCard>
  )
}
