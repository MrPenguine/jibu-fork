"use client"

import { Card } from "@libs/shadcn-ui/components/ui/card"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform configuration, admin users, and feature flags
        </p>
      </div>

      <Card className="p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="flex items-center justify-center w-16 h-16 bg-muted rounded-full mx-auto mb-4">
            <Settings className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Settings Coming Soon</h2>
          <p className="text-muted-foreground mb-6">
            Manage admin users, configure RBAC, set up feature flags, and configure alerting rules.
          </p>
        </div>
      </Card>
    </div>
  );
}
