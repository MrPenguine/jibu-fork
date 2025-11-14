"use client"

import { Card } from "@libs/shadcn-ui/components/ui/card"
import { DollarSign } from "lucide-react"

export default function BillingPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Finance</h1>
        <p className="text-sm text-gray-600 mt-1">
          Revenue dashboard, costs, subscriptions, and plan management
        </p>
      </div>

      <Card className="p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Billing & Finance Coming Soon</h2>
          <p className="text-gray-600 mb-6">
            Track MRR, ARR, costs breakdown by service, manage subscription plans, and monitor customer lifetime value.
          </p>
        </div>
      </Card>
    </div>
  );
}
