"use client"

import * as React from "react"
import { useWorkspace } from "../../../../../utils/workspaceContext"
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Phone } from "lucide-react"

export default function PhoneNumbersPage({ params }: { params: { workspaceId: string } }) {
  const { activeWorkspace, loading } = useWorkspace();

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
        <h1 className="text-2xl font-semibold">Phone numbers</h1>
      </div>

      {/* Empty state */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 dark:bg-gray-700">
          <Phone className="h-6 w-6 text-primary" />
        </div>
        <h3 className="mb-2 text-lg font-medium">No phone numbers yet</h3>
        <p className="mb-6 text-muted-foreground">
          Add a phone number to connect your agents with customers
        </p>
        <Button>
          <Phone className="mr-2 h-4 w-4" />
          Add phone number
        </Button>
      </div>
    </div>
  );
}
