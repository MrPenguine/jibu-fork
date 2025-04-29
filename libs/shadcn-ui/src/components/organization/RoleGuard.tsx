"use client";

import { ReactNode } from "react";
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext';
import { AlertCircle } from "lucide-react";

type AllowedRole = "owner" | "admin" | "member";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: AllowedRole[];
  fallback?: ReactNode;
}

export default function RoleGuard({ 
  children, 
  allowedRoles, 
  fallback 
}: RoleGuardProps) {
  const { activeOrganization, loading } = useOrganization();
  
  // If still loading, show nothing or a loading state
  if (loading) {
    return null;
  }
  
  // If no organization or user doesn't have a role, show the fallback or a default message
  if (!activeOrganization || !activeOrganization.role) {
    return fallback || (
      <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-md">
        You need to be part of an organization to access this content.
      </div>
    );
  }
  
  // Check if the user's role is in the allowed roles
  const hasAccess = allowedRoles.includes(activeOrganization.role as AllowedRole);
  
  if (!hasAccess) {
    return fallback || (
      <div className="flex gap-2 p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-md">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <div>
          <h3 className="font-medium">Access Denied</h3>
          <p className="text-sm">
            You need to be {allowedRoles.join(' or ')} to access this functionality.
            Current role: {activeOrganization.role}
          </p>
        </div>
      </div>
    );
  }
  
  // User has access, render the children
  return <>{children}</>;
} 