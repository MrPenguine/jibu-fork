"use client"

import { useEffect, useState } from "react"
import { StatCard } from "../../../../../libs/shadcn-ui/src/components/admin/shared/StatCard"
import { Card } from "@libs/shadcn-ui/components/ui/card"
import { Badge } from "@libs/shadcn-ui/components/ui/badge"
import {
  Users,
  UserPlus,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  Loader2,
} from "lucide-react"

interface DashboardStats {
  users: {
    total: number
    new30d: number
    new7d: number
    growthRate: number
  }
  workspaces: {
    total: number
  }
  agents: {
    total: number
    active24h: number
  }
  messages: {
    total: number
    last24h: number
  }
}

type ServiceStatus = "operational" | "degraded" | "outage"

function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  const config = {
    operational: { variant: "success" as const, icon: CheckCircle2 },
    degraded: { variant: "warning" as const, icon: AlertCircle },
    outage: { variant: "danger" as const, icon: XCircle },
  }

  const { variant, icon: Icon } = config[status] ?? config.operational

  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3 mr-1" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/admin/dashboard/stats")

        if (!response.ok) {
          throw new Error("Failed to fetch stats")
        }

        const data = (await response.json()) as DashboardStats
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Error loading dashboard: {error}</span>
          </div>
        </Card>
      </div>
    )
  }

  if (!stats) return null

  const mockSystemHealth = {
    apiLatency: { value: "145ms", status: "good" },
    errorRate: { value: "0.12%", status: "good" },
    services: [
      { name: "OpenAI", status: "operational" as ServiceStatus },
      { name: "ElevenLabs", status: "operational" as ServiceStatus },
      { name: "Twilio", status: "operational" as ServiceStatus },
      { name: "Google STT", status: "degraded" as ServiceStatus },
      { name: "Anthropic", status: "operational" as ServiceStatus },
    ],
  }

  const mockActivity = [
    {
      id: 1,
      type: "signup" as const,
      message: "User john@acme.com signed up",
      time: "2 minutes ago",
    },
    {
      id: 2,
      type: "milestone" as const,
      message: "Workspace 'Sales Co' reached 10,000 messages",
      time: "15 minutes ago",
    },
    {
      id: 3,
      type: "alert" as const,
      message: "High latency detected on Google STT API",
      time: "1 hour ago",
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Core Platform Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Platform Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value={stats.users.total.toLocaleString()}
            icon={Users}
            trend={{ value: stats.users.growthRate, label: "growth rate" }}
            iconClassName="bg-accent text-primary"
          />
          <StatCard
            title="New Users (7d)"
            value={stats.users.new7d.toLocaleString()}
            icon={UserPlus}
            trend={{ value: stats.users.new30d, label: "last 30 days" }}
            iconClassName="bg-accent text-primary"
          />
          <StatCard
            title="Workspaces"
            value={stats.workspaces.total.toLocaleString()}
            icon={Activity}
            iconClassName="bg-green-100 text-green-600"
          />
          <StatCard
            title="Total Agents"
            value={stats.agents.total.toLocaleString()}
            icon={MessageSquare}
            trend={{ value: stats.agents.active24h, label: "active (24h)" }}
            iconClassName="bg-accent text-primary"
          />
        </div>
      </div>

      {/* Activity Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Activity (Last 24h)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Messages"
            value={stats.messages.last24h.toLocaleString()}
            icon={Activity}
            iconClassName="bg-accent text-primary"
          />
          <StatCard
            title="Active Sessions"
            value={stats.agents.active24h.toLocaleString()}
            icon={CheckCircle2}
            iconClassName="bg-cyan-100 text-cyan-600"
          />
        </div>
      </div>

      {/* System Status & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">System Health</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-background rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">API Latency (p95)</p>
                <p className="text-xs text-muted-foreground">95th percentile response time</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">{mockSystemHealth.apiLatency.value}</p>
                <Badge variant="success" className="text-xs">
                  Good
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-background rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Error Rate</p>
                <p className="text-xs text-muted-foreground">5xx errors in last hour</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">{mockSystemHealth.errorRate.value}</p>
                <Badge variant="success" className="text-xs">
                  Good
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Third-Party Services</p>
              <div className="space-y-2">
                {mockSystemHealth.services.map((service) => (
                  <div key={service.name} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{service.name}</span>
                    <ServiceStatusBadge status={service.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {mockActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex gap-3 p-3 bg-background rounded-lg hover:bg-background transition-colors"
              >
                <div
                  className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                    activity.type === "signup"
                      ? "bg-green-500"
                      : activity.type === "milestone"
                      ? "bg-primary"
                      : "bg-brand-saffron"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{activity.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
