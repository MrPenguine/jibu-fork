"use client"

import { Card } from "@libs/shadcn-ui/components/ui/card"
import { FileText } from "lucide-react"

export default function LogsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Logs & Monitoring</h1>
        <p className="text-sm text-gray-600 mt-1">
          API logs, application logs, and job queue monitoring
        </p>
      </div>

      <Card className="p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mx-auto mb-4">
            <FileText className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">System Logs Coming Soon</h2>
          <p className="text-gray-600 mb-6">
            Monitor API usage, view application logs, and manage background job queues.
          </p>
        </div>
      </Card>
    </div>
  );
}
