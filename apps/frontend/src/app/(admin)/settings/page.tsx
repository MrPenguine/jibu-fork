"use client"

import { Card } from "@libs/shadcn-ui/components/ui/card"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600 mt-1">
          Platform configuration, admin users, and feature flags
        </p>
      </div>

      <Card className="p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4">
            <Settings className="h-8 w-8 text-gray-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Settings Coming Soon</h2>
          <p className="text-gray-600 mb-6">
            Manage admin users, configure RBAC, set up feature flags, and configure alerting rules.
          </p>
        </div>
      </Card>
    </div>
  );
}
