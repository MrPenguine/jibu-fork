"use client"

import * as React from "react"
import { Plus, User } from "lucide-react"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { MembersList } from "@libs/shadcn-ui/components/organization/MembersList"
import { InviteMembers } from "@libs/shadcn-ui/components/organization/InviteMembers"
import { useOrganization } from "../../../../utils/organizationContext"

export default function MembersPage() {
  const [showInviteModal, setShowInviteModal] = React.useState(false)
  const { activeOrganization } = useOrganization()
  
  // Determine if the user can invite members (only owner and admin)
  const canInviteMembers = 
    activeOrganization?.role === 'owner' || 
    activeOrganization?.role === 'admin';
  
  return (
    <div className="w-full p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <User className="h-7 w-7 text-muted-foreground" /> Members
            </h1>
            <p className="text-muted-foreground">
              Manage organization members and their access levels.
            </p>
          </div>
          
          <Button 
            className="rounded-xl"
            onClick={() => setShowInviteModal(true)}
            disabled={!canInviteMembers}
            title={!canInviteMembers ? "Only owners and admins can invite members" : ""}
          >
            <Plus className="mr-2 h-4 w-4" /> Invite Members
          </Button>
        </div>
        
        {/* Members list */}
        <MembersList />
        
        {/* Invite members modal */}
        <InviteMembers 
          isOpen={showInviteModal} 
          onClose={() => setShowInviteModal(false)} 
        />
      </div>
    </div>
  )
}
