"use client";

import { useOrganization } from "../../../../utils/organizationContext";
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton";
import { Separator } from "@libs/shadcn-ui/components/ui/separator";
import GetStartedChecklist from "../../../../components/onboarding/GetStartedChecklist";

export default function WorkspaceHomePage({ params }: { params: { workspaceId: string } }) {
  const { activeOrganization, loading } = useOrganization();

  if (loading || !activeOrganization) {
    return (
      <div className="w-full px-6 pb-6 pt-0">
        <div className="max-w-[1600px] mx-auto">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-4 w-2/3 mt-2" />
          <Separator className="mt-6" />
          <div className="flex justify-center mt-8">
            <Skeleton className="h-[240px] w-2/3 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const isSameWorkspace = params.workspaceId === activeOrganization.id;

  return (
    <div className="w-full px-6 pb-6 pt-0">
      <div className="max-w-[1600px] mx-auto">
        <div className="mt-0">
          <h1 className="text-3xl font-bold tracking-tight">Home</h1>
          <p className="text-muted-foreground">
            Workspace: {activeOrganization.name} {isSameWorkspace ? "" : `(viewing ${params.workspaceId})`}
          </p>
        </div>

        <Separator className="mt-6" />

        <div className="mt-8">
          {/* Placeholder for onboarding-aware home */}
          <GetStartedChecklist 
            status={{ createdAgent: false, addedNumber: false, invitedMember: false }} 
            workspaceId={params.workspaceId}
          />
        </div>
      </div>
    </div>
  );
}
