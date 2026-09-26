"use client";

import * as React from "react";
import { Plus, User } from "lucide-react";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { MembersList, MembersListHandle } from "@libs/shadcn-ui/components/workspace/MembersList";
import { InviteMembers } from "@libs/shadcn-ui/components/workspace/InviteMembers";
import { PendingInvitations } from "@libs/shadcn-ui/components/workspace/PendingInvitations";
import { useWorkspace } from "../../../../../utils/workspaceContext";
import { useParams } from "next/navigation";

export default function MembersPage() {
  const [showInviteModal, setShowInviteModal] = React.useState(false);
  const { activeWorkspace } = useWorkspace();
  const membersListRef = React.useRef<MembersListHandle>(null);
  const routeParams = useParams<{ workspaceId: string }>();
  const workspaceId = (routeParams?.workspaceId as string) || "";
  const refreshMembers = React.useCallback(() => {
    membersListRef.current?.refreshMembers();
  }, []);

  const canInviteMembers =
    activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";

  return (
    <div className="w-full p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Members
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage workspace members and their access levels.
            </p>
          </div>

          <Button
            className="rounded-md font-bold text-xs"
            onClick={() => setShowInviteModal(true)}
            disabled={!canInviteMembers}
            title={!canInviteMembers ? "Only owners and admins can invite members" : ""}
          >
            <Plus className="mr-2 h-4 w-4" /> Invite Members
          </Button>
        </div>

        <PendingInvitations
          workspaceId={workspaceId}
          refreshMembers={refreshMembers}
        />
        <MembersList ref={membersListRef} workspaceId={workspaceId} />
        <InviteMembers
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  );
}
