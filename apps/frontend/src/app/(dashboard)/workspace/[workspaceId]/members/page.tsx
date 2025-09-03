"use client"

import React, { useState, useEffect } from "react"
import { useWorkspace } from "../../../../../utils/workspaceContext"
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Search, Mail, Copy, Check, X, UserPlus } from "lucide-react"
import { Input } from "@libs/shadcn-ui/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@libs/shadcn-ui/components/ui/avatar"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@libs/shadcn-ui/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@libs/shadcn-ui/components/ui/dialog"
import { Label } from "@libs/shadcn-ui/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@libs/shadcn-ui/components/ui/tabs"
import { Card, CardContent } from "@libs/shadcn-ui/components/ui/card"
import { fetchAPI } from "../../../../../utils/api"
import { useParams } from "next/navigation"

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  isCurrentUser?: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function MembersPage() {
  const { activeWorkspace, loading } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [isSending, setIsSending] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("members");
  const routeParams = useParams<{ workspaceId: string }>();
  const workspaceId = (routeParams?.workspaceId as string) || "";

  useEffect(() => {
    const fetchMembers = async () => {
      if (!workspaceId) return;
      
      setIsLoading(true);
      try {
        // Fetch members
        const fetchedMembers = await fetchAPI(`/workspaces/${workspaceId}/members`);
        setMembers(fetchedMembers || []);
        
        // Fetch invitations
        const fetchedInvitations = await fetchAPI(`/v1/invitations/workspace/${workspaceId}`);
        setInvitations(fetchedInvitations || []);
      } catch (error) {
        console.error("Failed to fetch members or invitations:", error);
        // Set default data for demonstration
        setMembers([{
          id: "1",
          name: "Jibu AI",
          email: "jibu.ai@gmail.com",
          role: "admin",
          isCurrentUser: true
        }]);
        setInvitations([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMembers();
  }, [workspaceId]);

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !inviteRole) {
      alert("Please enter a valid email and select a role.");
      return;
    }
    
    setIsSending(true);
    try {
      const response = await fetchAPI(`/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole
        })
      });
      
      // Generate invite link (this would come from the backend in a real implementation)
      const generatedLink = `${window.location.origin}/invite/${response.id || 'sample-invite-id'}`;
      setInviteLink(generatedLink);
      
      // Add the new invitation to the list
      const newInvitation: Invitation = {
        id: response.id || `inv-${Date.now()}`,
        email: inviteEmail,
        role: inviteRole,
        status: "pending",
        createdAt: new Date().toISOString()
      };
      
      setInvitations(prev => [...prev, newInvitation]);
      setInviteEmail("");
      setActiveTab("link"); // Switch to the link tab
    } catch (error) {
      console.error("Failed to send invitation:", error);
      alert("Failed to send invitation. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setIsLinkCopied(true);
    setTimeout(() => setIsLinkCopied(false), 2000);
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (window.confirm("Are you sure you want to cancel this invitation?")) {
      try {
        await fetchAPI(`/workspaces/invitations/${invitationId}/revoke`, {
          method: "POST"
        });
        
        // Remove the invitation from the list
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      } catch (error) {
        console.error("Failed to cancel invitation:", error);
        alert("Failed to cancel invitation. Please try again.");
      }
    }
  };

  const filteredMembers = searchQuery
    ? members.filter(member => {
        const name = (member.name || '').toLowerCase();
        const email = (member.email || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : members;

  const filteredInvitations = searchQuery
    ? invitations.filter(inv => 
        inv.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : invitations;

  if (loading || !activeWorkspace) {
    return (
      <div className="w-full px-6 pb-6 pt-0">
        <Skeleton className="h-10 w-1/3" />
        <div className="mt-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 pb-6 pt-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">
          Members ({members.length}) {invitations.length > 0 && `• Pending (${invitations.length})`}
        </h1>
        <div className="flex gap-2">
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite members
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Members</DialogTitle>
                <DialogDescription>
                  Invite team members to collaborate in this workspace.
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="email" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="email">Email</TabsTrigger>
                  <TabsTrigger value="link">Invite Link</TabsTrigger>
                </TabsList>
                
                <TabsContent value="email" className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {inviteRole === "admin" ? "Admin" : 
                           inviteRole === "editor" ? "Editor" : 
                           inviteRole === "viewer" ? "Viewer" : "Select role"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        <DropdownMenuItem onClick={() => setInviteRole("admin")}>Admin</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setInviteRole("editor")}>Editor</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setInviteRole("viewer")}>Viewer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSendInvite} disabled={isSending}>
                      {isSending ? "Sending..." : "Send Invitation"}
                    </Button>
                  </DialogFooter>
                </TabsContent>
                
                <TabsContent value="link" className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Invite link</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={inviteLink || `${window.location.origin}/invite/sample-link`} 
                        readOnly 
                      />
                      <Button size="icon" onClick={handleCopyLink}>
                        {isLinkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Anyone with this link can join your workspace as an Editor.
                    </p>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>Close</Button>
                  </DialogFooter>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Access</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>All roles</DropdownMenuItem>
              <DropdownMenuItem>Admin</DropdownMenuItem>
              <DropdownMenuItem>Editor</DropdownMenuItem>
              <DropdownMenuItem>Viewer</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search members..." 
            className="pl-10" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="invitations">Pending ({invitations.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="members">
          <div className="bg-white dark:bg-gray-800 rounded-lg border">
            <div className="grid grid-cols-3 p-4 font-medium text-sm text-muted-foreground">
              <div>Name</div>
              <div>Email</div>
              <div>Role</div>
            </div>
            
            {isLoading ? (
              <div className="border-t p-4">
                <Skeleton className="h-8 w-full mb-2" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="border-t p-8 text-center">
                <p className="text-muted-foreground">No members found</p>
              </div>
            ) : (
              <div className="border-t">
                {filteredMembers.map((member) => (
                  <div key={member.id} className="grid grid-cols-3 p-4 items-center border-b last:border-b-0">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatarUrl || ""} />
                        <AvatarFallback className="bg-primary text-white">
                          {(member.name || member.email || '?').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.name || member.email || "Member"} {member.isCurrentUser && "(You)"}</span>
                    </div>
                    <div>
                      <span>{member.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="capitalize">{member.role}</span>
                      {!member.isCurrentUser && (
                        <Button variant="ghost" size="sm">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="invitations">
          <div className="bg-white dark:bg-gray-800 rounded-lg border">
            <div className="grid grid-cols-4 p-4 font-medium text-sm text-muted-foreground">
              <div>Email</div>
              <div>Role</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            
            {isLoading ? (
              <div className="border-t p-4">
                <Skeleton className="h-8 w-full mb-2" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : filteredInvitations.length === 0 ? (
              <div className="border-t p-8 text-center">
                <p className="text-muted-foreground">No pending invitations</p>
              </div>
            ) : (
              <div className="border-t">
                {filteredInvitations.map((invitation) => (
                  <div key={invitation.id} className="grid grid-cols-4 p-4 items-center border-b last:border-b-0">
                    <div>
                      <span>{invitation.email}</span>
                    </div>
                    <div>
                      <span className="capitalize">{invitation.role}</span>
                    </div>
                    <div>
                      <span className="capitalize">{invitation.status}</span>
                    </div>
                    <div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleCancelInvitation(invitation.id)}
                      >
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
