"use client"

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "../ui/dialog"
import { Button } from "../ui/button"
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { fetchAPI } from '../../../../../apps/frontend/src/utils/api'
import { useWorkspace } from '../../../../../apps/frontend/src/utils/workspaceContext'

interface JoinWorkspaceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invitation: {
    id: string
    token: string
    workspace: {
      name: string
    }
  }
  onSuccess?: () => void
}

export function JoinWorkspaceModal({ 
  open, 
  onOpenChange,
  invitation,
  onSuccess 
}: JoinWorkspaceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { refreshWorkspaces } = useWorkspace()

  const handleAccept = async () => {
    try {
      setIsSubmitting(true)
      setError(null)
      
      await fetchAPI(`/workspaces/invitations/${invitation.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action: 'accept', token: invitation.token })
      })
      
      onOpenChange(false)
      
      refreshWorkspaces()
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error('Error accepting invitation:', err)
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDecline = async () => {
    try {
      setIsSubmitting(true)
      setError(null)
      
      await fetchAPI(`/workspaces/invitations/${invitation.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action: 'reject', token: invitation.token })
      })
      
      onOpenChange(false)
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error('Error declining invitation:', err)
      setError(err instanceof Error ? err.message : 'Failed to decline invitation')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-xl border-0">
        <DialogHeader>
          <DialogTitle>Join Workspace</DialogTitle>
          <DialogDescription>
            You've been invited to join <strong>{invitation.workspace.name}</strong>. Would you like to accept this invitation?
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl mb-4">
              {error}
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            By accepting, you'll be able to access shared resources and collaborate with other members of this workspace.
          </p>
        </div>
        
        <DialogFooter className="gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleDecline}
            disabled={isSubmitting}
            className="rounded-xl border-0"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Decline'
            )}
          </Button>
          <Button 
            type="button"
            onClick={handleAccept}
            disabled={isSubmitting}
            className="rounded-xl border-0"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              'Accept & Join'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
