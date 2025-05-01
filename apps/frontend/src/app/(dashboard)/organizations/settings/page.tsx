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
import OrganizationSettings from "@libs/shadcn-ui/components/organization/OrganizationSettings";
import ServerUrlSettings from "@libs/shadcn-ui/components/organization/ServerUrlSettings";
import DeleteOrganization from "@libs/shadcn-ui/components/organization/DeleteOrganization";
import { RoleGuard } from "@libs/shadcn-ui/components/organization/RoleGuard";
import { useOrganization } from "../../../../utils/organizationContext";

export default function OrganizationSettingsPage() {
  const { activeOrganization, loading } = useOrganization();

  if (loading || !activeOrganization) {
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

  return (
    <div className="w-full px-6 pb-6 pt-0">
      <div className="max-w-[1600px] mx-auto">
        <div className="mt-0">
          <h1 className="text-3xl font-bold tracking-tight">{activeOrganization.name}</h1>
          <p className="text-muted-foreground">
            Manage organization settings and preferences.
          </p>
        </div>

        <Separator className="mt-6" />

        <div className="flex justify-center mt-8">
          <div className="w-full md:w-2/3">
            <RoleGuard allowedRoles={["owner", "admin"]}>
              <CustomCard>
                <CustomCardHeader>
                  <CardTitle>Organization Settings</CardTitle>
                  <CardDescription>
                    Update your organization's basic information
                  </CardDescription>
                </CustomCardHeader>
                <CustomCardContent>
                  <OrganizationSettings />
                </CustomCardContent>
              </CustomCard>
            </RoleGuard>
          </div>
        </div>
        
        <div className="flex justify-center mt-8">
          <div className="w-full md:w-2/3">
            <RoleGuard allowedRoles={["owner", "admin"]}>
              <CustomCard>
                <CustomCardHeader>
                  <CardTitle>Server URLs</CardTitle>
                  <CardDescription>
                    Configure server URLs for your organization
                  </CardDescription>
                </CustomCardHeader>
                <CustomCardContent>
                  <ServerUrlSettings />
                </CustomCardContent>
              </CustomCard>
            </RoleGuard>
          </div>
        </div>
        
        <div className="flex justify-center mt-8">
          <div className="w-full md:w-2/3">
            <RoleGuard allowedRoles={["owner"]}>
              <CustomDangerCard>
                <CustomCardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  <CardDescription>
                    Permanently delete this organization and all associated data
                  </CardDescription>
                </CustomCardHeader>
                <CustomCardContent>
                  <DeleteOrganization />
                </CustomCardContent>
              </CustomDangerCard>
            </RoleGuard>
          </div>
        </div>
      </div>
    </div>
  );
}

