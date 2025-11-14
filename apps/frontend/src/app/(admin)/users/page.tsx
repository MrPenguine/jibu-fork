"use client"

import { Card } from "@libs/shadcn-ui/components/ui/card"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Users, Search, Filter, UserPlus } from "lucide-react"

export default function UsersPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage all users across the platform
          </p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700">
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Coming Soon Card */}
      <Card className="p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="flex items-center justify-center w-16 h-16 bg-violet-100 rounded-full mx-auto mb-4">
            <Users className="h-8 w-8 text-violet-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">User Management Coming Soon</h2>
          <p className="text-gray-600 mb-6">
            This section will allow you to view, search, and manage all users on the platform. 
            Features will include user details, subscription management, activity logs, and more.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <div className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
              User Search & Filters
            </div>
            <div className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
              Subscription Management
            </div>
            <div className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
              User Impersonation
            </div>
            <div className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
              Activity Logs
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
