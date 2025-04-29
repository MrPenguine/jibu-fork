"use client";

import { useEffect, useState } from 'react';
import { Building2, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext';

export default function CurrentOrganization() {
  const router = useRouter();
  const { activeOrganization, loading, error } = useOrganization();

  const handleSettings = () => {
    router.push(`/organizations/settings`);
  };

  if (loading) {
    return (
      <div className="animate-pulse flex space-x-4">
        <div className="rounded-full bg-gray-200 h-12 w-12"></div>
        <div className="flex-1 space-y-4 py-1">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
        <p className="font-medium">Error</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!activeOrganization) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-md">
        No organization selected. Use the organization switcher to select an organization.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-medium">{activeOrganization.name}</h3>
            <p className="text-sm text-muted-foreground capitalize">{activeOrganization.role}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          onClick={handleSettings}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mt-4">
        This is your current active organization. Use the organization switcher in the sidebar to change organizations.
      </p>
    </div>
  );
} 