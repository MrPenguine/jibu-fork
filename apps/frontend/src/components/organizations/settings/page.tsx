"use client";

import {
  CardDescription,
  CardTitle,
  CustomCard,
  CustomCardContent,
  CustomCardHeader,
  CustomDangerCard,
} from "@libs/shadcn-ui/components/ui/custom-card";
import { Separator } from "@libs/shadcn-ui/components/ui/separator";
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton";
import WorkspaceSettings from "@libs/shadcn-ui/components/workspace/WorkspaceSettings";
import ServerUrlSettings from "@libs/shadcn-ui/components/workspace/ServerUrlSettings";
import DeleteWorkspace from "@libs/shadcn-ui/components/workspace/DeleteWorkspace";
import { RoleGuard } from "@libs/shadcn-ui/components/workspace/RoleGuard";
import { useWorkspace } from "../../../../utils/workspaceContext";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@libs/shadcn-ui/components/ui/alert";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkspaceSettingsPage() {
  const { activeWorkspace, loading } = useWorkspace();
  const router = useRouter();

  useEffect(() => {
    if (!loading && activeWorkspace?.id) {
      router.replace(`/workspace/${activeWorkspace.id}/settings`);
    }
  }, [loading, activeWorkspace?.id, router]);

  if (loading || !activeWorkspace) {
    return (
      <div className="w-full px-6 pb-6 pt-0">
        <div className="max-w-[1600px] mx-auto">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-4 w-2/3 mt-2" />
          <Separator className="mt-6" />
          <div className="flex justify-center mt-8">
            <Skeleton className="h-[200px] w-2/3 rounded-xl" />
          </div>
          <div className="flex justify-center mt-8">
            <Skeleton className="h-[150px] w-2/3 rounded-xl" />
          </div>
          <div className="flex justify-center mt-8">
            <Skeleton className="h-[100px] w-2/3 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const isEditor = activeWorkspace.role === 'editor';

  return (
    <div className="w-full px-6 pb-6 pt-0">
      <div className="max-w-[1600px] mx-auto">
        <div className="mt-0">
          <h1 className="text-3xl font-bold tracking-tight">{activeWorkspace.name}</h1>
          <p className="text-muted-foreground">
            Manage workspace settings and preferences.
          </p>
        </div>

        <Separator className="mt-6" />

        {isEditor && (
          <div className="mt-6">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                You have view-only access to workspace settings. Contact an admin or owner for changes.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="flex justify-center mt-8">
          <div className="w-full md:w-2/3">
            {isEditor ? (
              <CustomCard>
                <CustomCardHeader>
                  <CardTitle>Workspace Settings</CardTitle>
                  <CardDescription>
                    View your workspace's basic information
                  </CardDescription>
                </CustomCardHeader>
                <CustomCardContent>
                  <WorkspaceSettings readOnly={true} />
                </CustomCardContent>
              </CustomCard>
            ) : (
              <RoleGuard allowedRoles={["owner", "admin"]}>
                <CustomCard>
                  <CustomCardHeader>
                    <CardTitle>Workspace Settings</CardTitle>
                    <CardDescription>
                      Update your workspace's basic information
                    </CardDescription>
                  </CustomCardHeader>
                  <CustomCardContent>
                    <WorkspaceSettings />
                  </CustomCardContent>
                </CustomCard>
              </RoleGuard>
            )}
          </div>
        </div>
        
        <div className="flex justify-center mt-8">
          <div className="w-full md:w-2/3">
            {isEditor ? (
              <CustomCard>
                <CustomCardHeader>
                  <CardTitle>Server URLs</CardTitle>
                  <CardDescription>
                    View server URLs for your workspace
                  </CardDescription>
                </CustomCardHeader>
                <CustomCardContent>
                  <ServerUrlSettings readOnly={true} />
                </CustomCardContent>
              </CustomCard>
            ) : (
              <RoleGuard allowedRoles={["owner", "admin"]}>
                <CustomCard>
                  <CustomCardHeader>
                    <CardTitle>Server URLs</CardTitle>
                    <CardDescription>
                      Configure server URLs for your workspace
                    </CardDescription>
                  </CustomCardHeader>
                  <CustomCardContent>
                    <ServerUrlSettings />
                  </CustomCardContent>
                </CustomCard>
              </RoleGuard>
            )}
          </div>
        </div>
        
        {!isEditor && (
          <div className="flex justify-center mt-8">
            <div className="w-full md:w-2/3">
              <RoleGuard allowedRoles={["owner"]}>
                <CustomDangerCard>
                  <CustomCardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>
                      Permanently delete this workspace and all associated data
                    </CardDescription>
                  </CustomCardHeader>
                  <CustomCardContent>
                    <DeleteWorkspace />
                  </CustomCardContent>
                </CustomDangerCard>
              </RoleGuard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

