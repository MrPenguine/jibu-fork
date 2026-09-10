"use client"

import * as React from "react"
import {
  AlertCircle,
  BarChart3,
  DollarSign,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import { Badge } from "@libs/shadcn-ui/components/ui/badge"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Card } from "@libs/shadcn-ui/components/ui/card"

interface RevenueMetrics {
  periodDays: number
  activeSubscriptions: number
  mrrUsd: number
  arrUsd: number
}

interface CostMetrics {
  days: number
  totalCostUsd: number
}

interface MarginItem {
  workspaceId: string
  workspaceName: string | null
  workspaceEmail: string | null
  mrrUsd: number
  costUsd: number
  marginUsd: number
  marginPct: number | null
}

interface MarginMetrics {
  days: number
  items: MarginItem[]
}

interface TopWorkspace {
  workspaceId: string
  workspaceName: string | null
  workspaceEmail: string | null
  totalCostUsd: number
}

interface TopWorkspaceMetrics {
  days: number
  items: TopWorkspace[]
}

interface AnalyticsData {
  revenue: RevenueMetrics
  costs: CostMetrics
  margins: MarginMetrics
  topWorkspaces: TopWorkspaceMetrics
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value)

async function fetchAnalytics<T>(endpoint: string, days: number): Promise<T> {
  const response = await fetch(`${endpoint}?days=${days}`)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || body.message || "Failed to load analytics")
  }
  return response.json() as Promise<T>
}

export default function AnalyticsPage() {
  const [days, setDays] = React.useState(30)
  const [data, setData] = React.useState<AnalyticsData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadAnalytics = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [revenue, costs, margins, topWorkspaces] = await Promise.all([
        fetchAnalytics<RevenueMetrics>("/api/admin/analytics/revenue", days),
        fetchAnalytics<CostMetrics>("/api/admin/analytics/costs", days),
        fetchAnalytics<MarginMetrics>("/api/admin/analytics/margins", days),
        fetchAnalytics<TopWorkspaceMetrics>(
          "/api/admin/analytics/top-workspaces",
          days,
        ),
      ])
      setData({ revenue, costs, margins, topWorkspaces })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }, [days])

  React.useEffect(() => {
    void loadAnalytics()
  }, [loadAnalytics])

  const marginRevenue =
    data?.margins.items.reduce((total, item) => total + item.mrrUsd, 0) ?? 0
  const marginCost =
    data?.margins.items.reduce((total, item) => total + item.costUsd, 0) ?? 0
  const marginValue = marginRevenue - marginCost
  const marginPercent =
    marginRevenue > 0 ? (marginValue / marginRevenue) * 100 : null

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Revenue, costs, margins, and workspace usage for the selected period.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="analytics-days" className="text-sm text-muted-foreground">
            Period
          </label>
          <select
            id="analytics-days"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2"
            onClick={() => void loadAnalytics()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card className="border-destructive/30 bg-red-50 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Error loading analytics: {error}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void loadAnalytics()}
          >
            Try again
          </Button>
        </Card>
      ) : !data ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          No analytics data available.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Monthly revenue</p>
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground">
                {formatCurrency(data.revenue.mrrUsd)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.revenue.activeSubscriptions} active subscriptions ·{" "}
                {formatCurrency(data.revenue.arrUsd)} annualized
              </p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Platform costs</p>
                <BarChart3 className="h-5 w-5 text-brand-cinnabar" />
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground">
                {formatCurrency(data.costs.totalCostUsd)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Provider usage costs over {data.costs.days} days
              </p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Estimated margin</p>
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground">
                {formatCurrency(marginValue)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {marginPercent === null ? "No revenue data" : `${marginPercent.toFixed(1)}% margin`}
              </p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Top workspaces by cost
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Highest recorded provider usage in the selected period.
                </p>
              </div>
              <Badge variant="outline">
                {data.topWorkspaces.items.length} workspaces
              </Badge>
            </div>
            {data.topWorkspaces.items.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No workspace usage recorded for this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="bg-background text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium">Workspace</th>
                      <th className="px-6 py-3 text-left font-medium">Email</th>
                      <th className="px-6 py-3 text-right font-medium">Usage cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.topWorkspaces.items.map((workspace) => (
                      <tr key={workspace.workspaceId}>
                        <td className="px-6 py-3 font-medium text-foreground">
                          {workspace.workspaceName || workspace.workspaceId}
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {workspace.workspaceEmail || "—"}
                        </td>
                        <td className="px-6 py-3 text-right font-medium text-foreground">
                          {formatCurrency(workspace.totalCostUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
