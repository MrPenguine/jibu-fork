"use client"

import { Card } from "@libs/shadcn-ui/components/ui/card"
import { Building2 } from "lucide-react"

export default function WorkspacesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Workspace Management</h1>
        <p className="text-sm text-gray-600 mt-1">
          View and manage all workspaces on the platform
        </p>
      </div>

      <Card className="p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="flex items-center justify-center w-16 h-16 bg-violet-100 rounded-full mx-auto mb-4">
            <Building2 className="h-8 w-8 text-violet-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Workspace Management Coming Soon</h2>
          <p className="text-gray-600 mb-6">
            Manage workspaces, view agents, conversation logs, API keys, and workspace settings.
          </p>
        </div>
      </Card>
    </div>
  );
}
