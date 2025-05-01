"use client"

import * as React from "react"
import { Plus, Mail, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
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
import { fetchAPI } from '../../../../../apps/frontend/src/utils/api'

interface InviteMembersProps {
  isOpen: boolean
  onClose: () => void
  organizationId?: string
}

// Interface for email validation status
interface EmailStatus {
  email: string
  status: 'checking' | 'valid' | 'invalid' | 'exists' | 'already-invited' | 'not-registered'
  message?: string
}

export function InviteMembers({ isOpen, onClose, organizationId }: InviteMembersProps) {
  const { toast } = useToast()
  const { activeOrganization, inviteMembers } = useOrganization()
  const [emailsWithStatus, setEmailsWithStatus] = React.useState<EmailStatus[]>([])
  const [currentEmail, setCurrentEmail] = React.useState("")
  const [role, setRole] = React.useState("editor")
  const [message, setMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  
  // Get organization ID from props or active organization
  const targetOrgId = organizationId || activeOrganization?.id
  
  // Check if user has permission to invite members
  const userRole = activeOrganization?.role
  const canInviteMembers = userRole === 'owner' || userRole === 'admin'
  
  // Helper to check if all emails are valid
  const allEmailsValid = React.useMemo(() => {
    if (emailsWithStatus.length === 0) return false;
    return emailsWithStatus.every(e => e.status === 'valid');
  }, [emailsWithStatus]);
  
  // Function to validate an email against backend
  const validateEmail = async (email: string) => {
    try {
      // Add email with 'checking' status
      setEmailsWithStatus(prev => [...prev, { email, status: 'checking' }]);
      
      // Call backend validation endpoint
      const result = await fetchAPI(`/organizations/${targetOrgId}/validate-email`, {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      
      // Update email status based on response
      setEmailsWithStatus(prev => 
        prev.map(e => 
          e.email === email 
            ? { 
                email, 
                status: result.valid ? 'valid' : result.reason, 
                message: result.message 
              } 
            : e
        )
      );
    } catch (err) {
      console.error('Error validating email:', err);
      
      // Update with error status
      setEmailsWithStatus(prev => 
        prev.map(e => 
          e.email === email 
            ? { 
                email, 
                status: 'invalid', 
                message: 'Failed to validate email' 
              } 
            : e
        )
      );
    }
  };
  
  const addEmail = () => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (currentEmail && emailRegex.test(currentEmail) && !emailsWithStatus.some(e => e.email === currentEmail)) {
      // Add and start validation
      validateEmail(currentEmail);
      setCurrentEmail("");
    } else if (currentEmail && !emailRegex.test(currentEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      })
    } else if (emailsWithStatus.some(e => e.email === currentEmail)) {
      toast({
        title: "Duplicate email",
        description: "This email has already been added to the list.",
        variant: "destructive",
      })
    }
  }
  
  const removeEmail = (emailToRemove: string) => {
    setEmailsWithStatus(prev => prev.filter(e => e.email !== emailToRemove))
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
    
    if (emailsWithStatus.length === 0 || !allEmailsValid) {
      toast({
        title: "Error",
        description: "Please add at least one valid email.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      const validEmails = emailsWithStatus
        .filter(e => e.status === 'valid')
        .map(e => e.email);
        
      await inviteMembers(targetOrgId, validEmails, role, message || undefined)
      
      toast({
        title: "Invitations sent",
        description: `Invited ${validEmails.length} member${validEmails.length > 1 ? 's' : ''} to your organization.`,
        variant: "default",
      })
      
      setEmailsWithStatus([])
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
      setEmailsWithStatus([])
      setRole("editor")
      setMessage("")
      setIsSubmitting(false)
    }
  }, [isOpen])

  // Get status color class for email pills
  const getStatusColorClass = (status: EmailStatus['status']) => {
    switch (status) {
      case 'valid':
        return 'bg-green-600';
      case 'checking':
        return 'bg-blue-600';
      case 'not-registered':
        return 'bg-orange-500';
      case 'invalid':
      case 'exists':
      case 'already-invited':
        return 'bg-red-600';
      default:
        return 'bg-primary';
    }
  };

  // Get status icon for email pills
  const getStatusIcon = (status: EmailStatus['status']) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4" />;
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'not-registered':
        return <AlertCircle className="h-4 w-4" />;
      case 'invalid':
      case 'exists':
      case 'already-invited':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

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
          
          {/* Email pills with status */}
          {emailsWithStatus.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {emailsWithStatus.map((emailStatus, index) => (
                  <div 
                    key={index} 
                    className={`${getStatusColorClass(emailStatus.status)} text-white py-2 px-4 rounded-full flex items-center gap-2`}
                  >
                    {emailStatus.email}
                    <span className="flex items-center">
                      {getStatusIcon(emailStatus.status)}
                    </span>
                    <button 
                      onClick={() => removeEmail(emailStatus.email)}
                      className="rounded-full bg-black/20 p-1"
                      disabled={isSubmitting}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Status messages for invalid emails */}
              <div className="space-y-1">
                {emailsWithStatus.filter(e => e.status !== 'valid' && e.status !== 'checking' && e.message).map((emailStatus, idx) => (
                  <div key={`error-${idx}`} className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>
                      <strong>{emailStatus.email}:</strong> {emailStatus.message}
                    </span>
                  </div>
                ))}
              </div>
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
              <SelectContent className="max-h-56 overflow-y-auto rounded-xl border-0 p-1 shadow-lg">
                {userRole === 'owner' ? (
                  <>
                    <SelectItem 
                      value="admin" 
                      className="flex items-center gap-2 py-2 px-3 cursor-pointer rounded-lg data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary data-[highlighted]:bg-primary/10"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                        <span className="font-medium">Admin</span>
                      </div>
                      <div className="text-xs text-muted-foreground ml-6">
                        Can manage members and settings
                      </div>
                    </SelectItem>
                    <SelectItem 
                      value="editor" 
                      className="flex items-center gap-2 py-2 px-3 cursor-pointer rounded-lg data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary data-[highlighted]:bg-primary/10"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                        <span className="font-medium">Editor</span>
                      </div>
                      <div className="text-xs text-muted-foreground ml-6">
                        Can edit content but not manage members
                      </div>
                    </SelectItem>
                  </>
                ) : (
                  <SelectItem 
                    value="editor" 
                    className="flex items-center gap-2 py-2 px-3 cursor-pointer rounded-lg data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary data-[highlighted]:bg-primary/10"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <span className="font-medium">Editor</span>
                    </div>
                    <div className="text-xs text-muted-foreground ml-6">
                      Can edit content but not manage members
                    </div>
                  </SelectItem>
                )}
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
            disabled={!canInviteMembers || !allEmailsValid || emailsWithStatus.length === 0 || isSubmitting}
            onClick={handleInvite}
            title={!canInviteMembers ? "Only owners and admins can invite members" : 
                   !allEmailsValid ? "All emails must be valid before inviting" : ""}
          >
            {isSubmitting ? "Sending..." : "Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 