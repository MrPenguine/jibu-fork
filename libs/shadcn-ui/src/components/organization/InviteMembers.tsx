"use client"

import * as React from "react"
import { Plus, Mail, X } from "lucide-react"
import { Input } from "@libs/shadcn-ui/components/ui/input"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@libs/shadcn-ui/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@libs/shadcn-ui/components/ui/select"
import { useToast } from "@libs/shadcn-ui/components/ui/use-toast"
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext'

interface InviteMembersProps {
  isOpen: boolean
  onClose: () => void
  organizationId?: string
}

export function InviteMembers({ isOpen, onClose, organizationId }: InviteMembersProps) {
  const { toast } = useToast()
  const { activeOrganization, inviteMembers } = useOrganization()
  const [emails, setEmails] = React.useState<string[]>([])
  const [currentEmail, setCurrentEmail] = React.useState("")
  const [role, setRole] = React.useState("editor")
  const [message, setMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  
  // Get organization ID from props or active organization
  const targetOrgId = organizationId || activeOrganization?.id
  
  // Check if user has permission to invite members
  const userRole = activeOrganization?.role
  const canInviteMembers = userRole === 'owner' || userRole === 'admin'
  
  const addEmail = () => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (currentEmail && emailRegex.test(currentEmail) && !emails.includes(currentEmail)) {
      setEmails([...emails, currentEmail])
      setCurrentEmail("")
    } else if (currentEmail && !emailRegex.test(currentEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      })
    }
  }
  
  const removeEmail = (emailToRemove: string) => {
    setEmails(emails.filter(email => email !== emailToRemove))
  }
  
  const handleInvite = async () => {
    if (!canInviteMembers) {
      toast({
        title: "Permission denied",
        description: "Only owners and admins can invite members.",
        variant: "destructive",
      })
      return
    }
    
    if (!targetOrgId) {
      toast({
        title: "Error",
        description: "No organization selected.",
        variant: "destructive",
      })
      return
    }
    
    if (emails.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one email.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      await inviteMembers(targetOrgId, emails, role, message || undefined)
      
      toast({
        title: "Invitations sent",
        description: `Invited ${emails.length} member${emails.length > 1 ? 's' : ''} to your organization.`,
        variant: "default",
      })
      
      setEmails([])
      onClose()
    } catch (error) {
      console.error("Error sending invitations:", error)
      toast({
        title: "Error sending invitations",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Reset form when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setCurrentEmail("")
      setEmails([])
      setRole("editor")
      setMessage("")
      setIsSubmitting(false)
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Invite New Members
          </DialogTitle>
          <DialogDescription>
            Add people to your organization and collaborate with them.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div>
            <h3 className="font-medium mb-2">Invite Users by email</h3>
            <div className="flex gap-2">
              <Input 
                type="email"
                placeholder="username@example.com"
                value={currentEmail}
                onChange={(e) => setCurrentEmail(e.target.value)}
                className="flex-1 rounded-xl"
                disabled={!canInviteMembers || isSubmitting}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addEmail()
                  }
                }}
              />
              <Button 
                className="rounded-full h-10 w-10 p-0"
                onClick={addEmail}
                disabled={!canInviteMembers || isSubmitting}
              >
                <Plus className="h-6 w-6" />
              </Button>
            </div>
          </div>
          
          {/* Email pills */}
          {emails.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {emails.map((email, index) => (
                <div 
                  key={index} 
                  className="bg-primary text-white py-2 px-4 rounded-full flex items-center gap-2"
                >
                  {email}
                  <button 
                    onClick={() => removeEmail(email)}
                    className="rounded-full bg-black/20 p-1"
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div>
            <h3 className="font-medium mb-2">Role</h3>
            <Select 
              value={role} 
              onValueChange={setRole} 
              disabled={!canInviteMembers || isSubmitting}
            >
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Message (optional)</h3>
            <Input
              type="text"
              placeholder="Add a personal message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl"
              disabled={!canInviteMembers || isSubmitting}
            />
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            className="rounded-xl"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            className="rounded-xl"
            disabled={!canInviteMembers || emails.length === 0 || isSubmitting}
            onClick={handleInvite}
            title={!canInviteMembers ? "Only owners and admins can invite members" : ""}
          >
            {isSubmitting ? "Sending..." : "Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 