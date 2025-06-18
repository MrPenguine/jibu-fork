"use client";

import React from 'react';
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext';

interface RoleGateProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallback?: React.ReactNode;
}

/**
 * RoleGate component conditionally renders content based on the user's organization role
 *
 * @param children - The content to show if the user has the required role
 * @param allowedRoles - Array of roles that are allowed to see the content
 * @param fallback - Optional content to show if the user doesn't have the required role
 */
export const RoleGate: React.FC<RoleGateProps> = ({ 
  children, 
  allowedRoles,
  fallback = null
}) => {
  const { activeOrganization, loading } = useOrganization();
  const orgRole = activeOrganization?.role;
  
  // While loading, don't render anything
  if (loading) {
    return null;
  }
  
  // Check if the user has an organization role that's included in the allowed roles
  if (!orgRole || !allowedRoles.includes(orgRole)) {
    return <>{fallback}</>;
  }
  
  // User has the required role, show the content
  return <>{children}</>;
}; 