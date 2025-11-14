"use client"

import { Card } from "@libs/shadcn-ui/components/ui/card"
import { BarChart3 } from "lucide-react"

export default function AnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-600 mt-1">
          Deep insights into platform usage and user behavior
        </p>
      </div>

      <Card className="p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Analytics Coming Soon</h2>
          <p className="text-gray-600 mb-6">
            View model popularity, voice usage, conversation analytics, and user funnels.
          </p>
        </div>
      </Card>
    </div>
  );
}
