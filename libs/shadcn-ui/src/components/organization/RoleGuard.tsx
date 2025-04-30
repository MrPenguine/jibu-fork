"use client";

import { ReactNode } from 'react';
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext';
import { AlertCircle } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: string[];
  children: ReactNode;
  fallback?: ReactNode;
  showError?: boolean;
}

/**
 * Renders children only if the current user has one of the allowed roles
 * in the active organization.
 */
export function RoleGuard({ 
  allowedRoles, 
  children, 
  fallback = null,
  showError = true
}: RoleGuardProps) {
  const { activeOrganization, loading } = useOrganization();
  
  // Don't render anything if still loading
  if (loading) {
    return null;
  }
  
  // Check if user has an organization with the required role
  const hasPermission = 
    activeOrganization?.role && 
    allowedRoles.includes(activeOrganization.role);
  
  if (!hasPermission) {
    if (showError) {
      return (
        <div className="flex gap-2 p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-md my-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <h3 className="font-medium">Access Denied</h3>
            <p className="text-sm">
              You don't have permission to view this content. Required role: {allowedRoles.join(' or ')}.
              {activeOrganization?.role && 
                ` Your role: ${activeOrganization.role}.`
              }
            </p>
          </div>
        </div>
      );
    }
    
    return fallback;
  }
  
  return <>{children}</>;
} 