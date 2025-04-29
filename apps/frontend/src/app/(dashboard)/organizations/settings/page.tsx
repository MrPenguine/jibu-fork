"use client";

import { Separator } from "@libs/shadcn-ui/components/ui/separator";
import OrganizationSettings from "@libs/shadcn-ui/components/organization/OrganizationSettings";
import ServerUrlSettings from "@libs/shadcn-ui/components/organization/ServerUrlSettings";
import DeleteOrganization from "@libs/shadcn-ui/components/organization/DeleteOrganization";
import RoleGuard from "@libs/shadcn-ui/components/organization/RoleGuard";
import { useOrganization } from "../../../../utils/organizationContext";

export default function OrganizationSettingsPage() {
  const { activeOrganization, loading } = useOrganization();

  if (loading || !activeOrganization) {
    return (
      <div className="container py-8 space-y-8 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="h-64 bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{activeOrganization.name}</h1>
        <p className="text-muted-foreground">
          Manage organization settings and preferences.
        </p>
      </div>

      <Separator />

      <RoleGuard allowedRoles={["owner", "admin"]}>
        <OrganizationSettings />
      </RoleGuard>
      
      <Separator />
      
      <RoleGuard allowedRoles={["owner", "admin"]}>
        <ServerUrlSettings />
      </RoleGuard>
      
      <Separator />
      
      <RoleGuard allowedRoles={["owner"]}>
        <DeleteOrganization />
      </RoleGuard>
    </div>
  );
}

