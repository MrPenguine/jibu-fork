"use client"

import * as React from "react"
import { useWorkspace } from "../../../../../utils/workspaceContext"
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@libs/shadcn-ui/components/ui/tabs"
import { BarChart, LineChart } from "lucide-react"

export default function UsagePage({ params }: { params: { workspaceId: string } }) {
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
        <h1 className="text-2xl font-semibold">Usage</h1>
        <Tabs defaultValue="7d" className="w-auto">
          <TabsList>
            <TabsTrigger value="7d">7d</TabsTrigger>
            <TabsTrigger value="30d">30d</TabsTrigger>
            <TabsTrigger value="90d">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total API calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <div className="text-xs text-muted-foreground mt-1">0% from last period</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <div className="text-xs text-muted-foreground mt-1">0% from last period</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <div className="text-xs text-muted-foreground mt-1">0% from last period</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Usage over time</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <LineChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No usage data available for this period</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Usage by model</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <BarChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No usage data available for this period</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
