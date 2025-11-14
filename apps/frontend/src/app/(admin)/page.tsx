"use client"

import { StatCard } from "../../../../libs/shadcn-ui/src/components/admin/shared/StatCard"
import { Card } from "@libs/shadcn-ui/components/ui/card"
import { Badge } from "@libs/shadcn-ui/components/ui/badge"
import { 
  DollarSign, 
  Users, 
  UserPlus, 
  TrendingDown,
  MessageSquare,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity
} from "lucide-react"

// Mock data - replace with real API calls later
const mockMetrics = {
  mrr: { value: "$24,500", trend: { value: 12.5, label: "vs last month" } },
  activeSubscriptions: { value: "342", trend: { value: 8.2, label: "vs last month" } },
  newSignups: { value: "47", trend: { value: 15.3, label: "last 7 days" } },
  churnRate: { value: "2.3%", trend: { value: -0.5, label: "vs last month" } },
  activeAgents: { value: "1,284", trend: { value: 5.7, label: "last 24h" } },
  conversationMinutes: { value: "12,450", trend: { value: 18.2, label: "today" } },
  apiCalls: { value: "45.2K", trend: { value: 3.1, label: "last hour" } },
  avgCallDuration: { value: "2.5 min", trend: { value: 5.0, label: "vs yesterday" } },
};

const mockSystemHealth = {
  apiLatency: { value: "145ms", status: "good" },
  errorRate: { value: "0.12%", status: "good" },
  services: [
    { name: "OpenAI", status: "operational" },
    { name: "ElevenLabs", status: "operational" },
    { name: "Twilio", status: "operational" },
    { name: "Google STT", status: "degraded" },
    { name: "Anthropic", status: "operational" },
  ]
};

const mockActivity = [
  { id: 1, type: "signup", message: "User john@acme.com signed up for Pro plan", time: "2 minutes ago" },
  { id: 2, type: "milestone", message: "Workspace 'Sales Co' reached 10,000 messages", time: "15 minutes ago" },
  { id: 3, type: "alert", message: "High latency detected on Google STT API", time: "1 hour ago" },
  { id: 4, type: "signup", message: "User sarah@startup.io signed up for Starter plan", time: "2 hours ago" },
  { id: 5, type: "milestone", message: "Platform reached 1M total conversations", time: "3 hours ago" },
];

function ServiceStatusBadge({ status }: { status: string }) {
  const config = {
    operational: { color: "bg-green-100 text-green-700", icon: CheckCircle2 },
    degraded: { color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
    outage: { color: "bg-red-100 text-red-700", icon: XCircle },
  };
  
  const { color, icon: Icon } = config[status as keyof typeof config] || config.operational;
  
  return (
    <Badge variant="outline" className={`${color} border-0`}>
      <Icon className="h-3 w-3 mr-1" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-6">
      {/* Core Business Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Core Business Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="MRR"
            value={mockMetrics.mrr.value}
            icon={DollarSign}
            trend={mockMetrics.mrr.trend}
            iconClassName="bg-green-100 text-green-600"
          />
          <StatCard
            title="Active Subscriptions"
            value={mockMetrics.activeSubscriptions.value}
            icon={Users}
            trend={mockMetrics.activeSubscriptions.trend}
            iconClassName="bg-blue-100 text-blue-600"
          />
          <StatCard
            title="New Signups (7d)"
            value={mockMetrics.newSignups.value}
            icon={UserPlus}
            trend={mockMetrics.newSignups.trend}
            iconClassName="bg-purple-100 text-purple-600"
          />
          <StatCard
            title="Churn Rate"
            value={mockMetrics.churnRate.value}
            icon={TrendingDown}
            trend={mockMetrics.churnRate.trend}
            iconClassName="bg-amber-100 text-amber-600"
          />
        </div>
      </div>

      {/* Platform Usage Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Agents (24h)"
            value={mockMetrics.activeAgents.value}
            icon={MessageSquare}
            trend={mockMetrics.activeAgents.trend}
            iconClassName="bg-violet-100 text-violet-600"
          />
          <StatCard
            title="Conversation Minutes"
            value={mockMetrics.conversationMinutes.value}
            icon={Clock}
            trend={mockMetrics.conversationMinutes.trend}
            iconClassName="bg-indigo-100 text-indigo-600"
          />
          <StatCard
            title="API Calls (1h)"
            value={mockMetrics.apiCalls.value}
            icon={Zap}
            trend={mockMetrics.apiCalls.trend}
            iconClassName="bg-cyan-100 text-cyan-600"
          />
          <StatCard
            title="Avg Call Duration"
            value={mockMetrics.avgCallDuration.value}
            icon={Activity}
            trend={mockMetrics.avgCallDuration.trend}
            iconClassName="bg-pink-100 text-pink-600"
          />
        </div>
      </div>

      {/* System Health & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
          
          <div className="space-y-4">
            {/* API Latency */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">API Latency (p95)</p>
                <p className="text-xs text-gray-500">95th percentile response time</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{mockSystemHealth.apiLatency.value}</p>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-0 text-xs">
                  Good
                </Badge>
              </div>
            </div>

            {/* Error Rate */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Error Rate</p>
                <p className="text-xs text-gray-500">5xx errors in last hour</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{mockSystemHealth.errorRate.value}</p>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-0 text-xs">
                  Good
                </Badge>
              </div>
            </div>

            {/* Third-Party Services */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Third-Party Services</p>
              <div className="space-y-2">
                {mockSystemHealth.services.map((service) => (
                  <div key={service.name} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{service.name}</span>
                    <ServiceStatusBadge status={service.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {mockActivity.map((activity) => (
              <div key={activity.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                  activity.type === 'signup' ? 'bg-green-500' :
                  activity.type === 'milestone' ? 'bg-blue-500' :
                  'bg-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
