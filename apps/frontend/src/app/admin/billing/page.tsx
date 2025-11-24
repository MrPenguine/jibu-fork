"use client"

import * as React from "react"
import { Card } from "@libs/shadcn-ui/components/ui/card"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Input } from "@libs/shadcn-ui/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@libs/shadcn-ui/components/ui/tabs"
import { LineChart, PieChart, Plus } from "lucide-react"

interface AdminPlan {
  id: string
  name: string
  priceMonthly: number | null
  priceYearly: number | null
  creditsIncluded: number
  features: any
  isActive: boolean
  activeSubscriptionsCount?: number
}

interface RevenuePlanMetrics {
  planId: string
  planName: string
  mrrUsd: number
  arrUsd: number
  activeSubscriptions: number
}

interface RevenueMetrics {
  periodDays: number
  activeSubscriptions: number
  mrrUsd: number
  arrUsd: number
  byPlan: RevenuePlanMetrics[]
  timestamp: string
}

interface CostByProviderEntry {
  provider: string
  costInMicroUSD: number
  costUsd: number
}

interface CostByTypeEntry {
  type: string
  costInMicroUSD: number
  costUsd: number
}

interface CostBreakdown {
  days: number
  since: string
  totalCostInMicroUSD: number
  totalCostUsd: number
  byProvider: CostByProviderEntry[]
  byType: CostByTypeEntry[]
}

interface TopWorkspaceCostItem {
  workspaceId: string
  workspaceName: string | null
  workspaceEmail: string | null
  totalCostInMicroUSD: number
  totalCostUsd: number
}

interface TopWorkspacesResult {
  days: number
  since: string
  items: TopWorkspaceCostItem[]
}

interface AdminSubscription {
  id: string
  workspaceId: string
  workspace?: {
    id: string
    name: string | null
    email: string | null
  } | null
  planId: string
  plan?: {
    id: string
    name: string
  } | null
  status: string
  currentPeriodEnd: string
  creditsUsed: number
  creditsLimit: number | null
}

export default function BillingPage() {
  const [activeTab, setActiveTab] = React.useState("plans")

  const [plans, setPlans] = React.useState<AdminPlan[]>([])
  const [loadingPlans, setLoadingPlans] = React.useState(true)
  const [planError, setPlanError] = React.useState<string | null>(null)
  const [savingPlan, setSavingPlan] = React.useState(false)
  const [editingPlanId, setEditingPlanId] = React.useState<string | null>(null)
  const [revenue, setRevenue] = React.useState<RevenueMetrics | null>(null)
  const [loadingRevenue, setLoadingRevenue] = React.useState(false)
  const [revenueError, setRevenueError] = React.useState<string | null>(null)
  const [costs, setCosts] = React.useState<CostBreakdown | null>(null)
  const [topWorkspaces, setTopWorkspaces] = React.useState<TopWorkspacesResult | null>(null)
  const [loadingCosts, setLoadingCosts] = React.useState(false)
  const [costsError, setCostsError] = React.useState<string | null>(null)
  const [subscriptions, setSubscriptions] = React.useState<AdminSubscription[]>([])
  const [loadingSubscriptions, setLoadingSubscriptions] = React.useState(false)
  const [subscriptionsError, setSubscriptionsError] = React.useState<string | null>(null)
  const [formValues, setFormValues] = React.useState({
    name: "",
    priceMonthly: "",
    priceYearly: "",
    creditsIncluded: "",
    features: "{\n  \"apiAccess\": true\n}",
  })

  React.useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoadingPlans(true)
        setPlanError(null)

        const res = await fetch("/api/admin/plans")
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || body.message || "Failed to load plans")
        }

        const json = await res.json()
        setPlans(Array.isArray(json) ? json : [])
      } catch (err: any) {
        setPlanError(err?.message || "Failed to load plans")
      } finally {
        setLoadingPlans(false)
      }
    }

    fetchPlans()
  }, [])

  React.useEffect(() => {
    const fetchAnalyticsAndSubscriptions = async () => {
      setLoadingRevenue(true)
      setLoadingCosts(true)
      setLoadingSubscriptions(true)
      setRevenueError(null)
      setCostsError(null)
      setSubscriptionsError(null)

      try {
        const [revRes, costRes, topWsRes, subsRes] = await Promise.all([
          fetch("/api/admin/analytics/revenue"),
          fetch("/api/admin/analytics/costs"),
          fetch("/api/admin/analytics/top-workspaces?limit=10"),
          fetch("/api/admin/subscriptions?page=1&pageSize=50"),
        ])

        if (revRes.ok) {
          const json = await revRes.json()
          setRevenue(json)
        } else {
          const body = await revRes.json().catch(() => ({}))
          setRevenueError(body.error || body.message || "Failed to load revenue metrics")
        }

        if (costRes.ok) {
          const json = await costRes.json()
          setCosts(json)
        } else {
          const body = await costRes.json().catch(() => ({}))
          setCostsError(body.error || body.message || "Failed to load cost metrics")
        }

        if (topWsRes.ok) {
          const json = await topWsRes.json()
          setTopWorkspaces(json)
        } else {
          const body = await topWsRes.json().catch(() => ({}))
          setCostsError((prev) => prev || body.error || body.message || "Failed to load top workspaces")
        }

        if (subsRes.ok) {
          const json = await subsRes.json()
          const items = Array.isArray(json.items) ? json.items : []
          setSubscriptions(items)
        } else {
          const body = await subsRes.json().catch(() => ({}))
          setSubscriptionsError(body.error || body.message || "Failed to load subscriptions")
        }
      } catch (err: any) {
        const message = err?.message || "Failed to load billing analytics"
        setRevenueError((prev) => prev || message)
        setCostsError((prev) => prev || message)
        setSubscriptionsError((prev) => prev || message)
      } finally {
        setLoadingRevenue(false)
        setLoadingCosts(false)
        setLoadingSubscriptions(false)
      }
    }

    fetchAnalyticsAndSubscriptions()
  }, [])

  const resetForm = () => {
    setEditingPlanId(null)
    setFormValues({
      name: "",
      priceMonthly: "",
      priceYearly: "",
      creditsIncluded: "",
      features: "{\n  \"apiAccess\": true\n}",
    })
  }

  const onEditPlan = (plan: AdminPlan) => {
    setEditingPlanId(plan.id)
    setFormValues({
      name: plan.name,
      priceMonthly: plan.priceMonthly != null ? String(plan.priceMonthly) : "",
      priceYearly: plan.priceYearly != null ? String(plan.priceYearly) : "",
      creditsIncluded: String(plan.creditsIncluded),
      features: JSON.stringify(plan.features ?? {}, null, 2),
    })
  }

  const handleFormChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  const refreshPlans = async () => {
    try {
      setLoadingPlans(true)
      setPlanError(null)
      const res = await fetch("/api/admin/plans")
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || body.message || "Failed to load plans")
      }
      const json = await res.json()
      setPlans(Array.isArray(json) ? json : [])
    } catch (err: any) {
      setPlanError(err?.message || "Failed to load plans")
    } finally {
      setLoadingPlans(false)
    }
  }

  const onSubmitPlan = async (event: React.FormEvent) => {
    event.preventDefault()

    try {
      setSavingPlan(true)
      setPlanError(null)

      let parsedFeatures: any = {}
      if (formValues.features.trim()) {
        try {
          parsedFeatures = JSON.parse(formValues.features)
        } catch {
          throw new Error("Features must be valid JSON")
        }
      }

      const payload: any = {
        name: formValues.name.trim(),
        creditsIncluded: formValues.creditsIncluded
          ? parseInt(formValues.creditsIncluded, 10)
          : 0,
        features: parsedFeatures,
      }

      if (formValues.priceMonthly !== "") {
        payload.priceMonthly = parseFloat(formValues.priceMonthly)
      } else {
        payload.priceMonthly = null
      }

      if (formValues.priceYearly !== "") {
        payload.priceYearly = parseFloat(formValues.priceYearly)
      } else {
        payload.priceYearly = null
      }

      const endpoint = editingPlanId
        ? `/api/admin/plans/${editingPlanId}`
        : "/api/admin/plans"
      const method = editingPlanId ? "PATCH" : "POST"

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || body.message || "Failed to save plan")
      }

      await refreshPlans()
      resetForm()
    } catch (err: any) {
      setPlanError(err?.message || "Failed to save plan")
    } finally {
      setSavingPlan(false)
    }
  }

  const onDeactivatePlan = async (id: string) => {
    try {
      setPlanError(null)
      const res = await fetch(`/api/admin/plans/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || body.message || "Failed to deactivate plan")
      }
      await refreshPlans()
    } catch (err: any) {
      setPlanError(err?.message || "Failed to deactivate plan")
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Finance</h1>
        <p className="text-sm text-gray-600 mt-1">
          Revenue dashboard, costs, subscriptions, and plan management
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LineChart className="h-5 w-5 text-violet-500" />
                <div>
                  <p className="text-xs font-medium text-gray-500">Revenue overview</p>
                  <p className="text-xs text-gray-400">Last {revenue?.periodDays ?? 30} days</p>
                </div>
              </div>
              {revenue && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">MRR</p>
                  <p className="text-lg font-semibold text-gray-900">${revenue.mrrUsd.toFixed(2)}</p>
                </div>
              )}
            </div>

            {loadingRevenue ? (
              <div className="text-sm text-gray-500 text-center">Loading revenue metrics...</div>
            ) : revenueError ? (
              <div className="text-sm text-red-600 text-center">{revenueError}</div>
            ) : !revenue ? (
              <div className="text-sm text-gray-500 text-center">No revenue data yet.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">MRR</p>
                    <p className="text-base font-semibold text-gray-900">${revenue.mrrUsd.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">ARR</p>
                    <p className="text-base font-semibold text-gray-900">${revenue.arrUsd.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Active subscriptions</p>
                    <p className="text-base font-semibold text-gray-900">{revenue.activeSubscriptions}</p>
                  </div>
                </div>

                {revenue.byPlan && revenue.byPlan.length > 0 && (
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Plan
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Active Subs
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            MRR
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ARR
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenue.byPlan.map((plan) => (
                          <tr key={plan.planId} className="border-b border-gray-100">
                            <td className="px-4 py-2 text-xs text-gray-800">{plan.planName}</td>
                            <td className="px-4 py-2 text-right text-xs text-gray-700">{plan.activeSubscriptions}</td>
                            <td className="px-4 py-2 text-right text-xs text-gray-700">${plan.mrrUsd.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right text-xs text-gray-700">${plan.arrUsd.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Subscriptions</h2>
              <p className="text-xs text-gray-500">First 50 subscriptions</p>
            </div>

            {loadingSubscriptions ? (
              <div className="text-sm text-gray-500 text-center">Loading subscriptions...</div>
            ) : subscriptionsError ? (
              <div className="text-sm text-red-600 text-center">{subscriptionsError}</div>
            ) : subscriptions.length === 0 ? (
              <div className="text-sm text-gray-500 text-center">No subscriptions yet.</div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Workspace
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Plan
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credits
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Renews / Ends
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((sub) => {
                      const workspaceLabel = sub.workspace?.name || sub.workspace?.email || sub.workspaceId
                      const planLabel = sub.plan?.name || sub.planId
                      const creditsLabel =
                        sub.creditsLimit != null
                          ? `${sub.creditsUsed.toLocaleString()} / ${sub.creditsLimit.toLocaleString()}`
                          : `${sub.creditsUsed.toLocaleString()} used`
                      const periodEnd = sub.currentPeriodEnd
                        ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                        : "—"

                      return (
                        <tr key={sub.id} className="border-b border-gray-100">
                          <td className="px-4 py-2 text-xs text-gray-800">
                            <div className="flex flex-col">
                              <span className="font-medium">{workspaceLabel}</span>
                              {sub.workspace?.email && (
                                <span className="text-[11px] text-gray-500">{sub.workspace.email}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-800">{planLabel}</td>
                          <td className="px-4 py-2 text-xs text-gray-800">{sub.status}</td>
                          <td className="px-4 py-2 text-right text-xs text-gray-800">{creditsLabel}</td>
                          <td className="px-4 py-2 text-right text-xs text-gray-800">{periodEnd}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-xs font-medium text-gray-500">Provider costs</p>
                  <p className="text-xs text-gray-400">Last {costs?.days ?? 30} days</p>
                </div>
              </div>
              {costs && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total cost</p>
                  <p className="text-lg font-semibold text-gray-900">${costs.totalCostUsd.toFixed(2)}</p>
                </div>
              )}
            </div>

            {loadingCosts ? (
              <div className="text-sm text-gray-500 text-center">Loading cost metrics...</div>
            ) : costsError ? (
              <div className="text-sm text-red-600 text-center">{costsError}</div>
            ) : !costs ? (
              <div className="text-sm text-gray-500 text-center">No usage cost data yet.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">By provider</h3>
                  {costs.byProvider.length === 0 ? (
                    <p className="text-xs text-gray-500">No provider costs yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {costs.byProvider.map((row) => (
                          <tr key={row.provider} className="border-b border-gray-100">
                            <td className="px-2 py-1 text-xs text-gray-800">{row.provider}</td>
                            <td className="px-2 py-1 text-right text-xs text-gray-800">${row.costUsd.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">By type</h3>
                  {costs.byType.length === 0 ? (
                    <p className="text-xs text-gray-500">No type breakdown yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {costs.byType.map((row) => (
                          <tr key={row.type} className="border-b border-gray-100">
                            <td className="px-2 py-1 text-xs text-gray-800">{row.type}</td>
                            <td className="px-2 py-1 text-right text-xs text-gray-800">${row.costUsd.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Top workspaces by spend</h2>
              <p className="text-xs text-gray-500">Last {topWorkspaces?.days ?? costs?.days ?? 30} days</p>
            </div>

            {loadingCosts ? (
              <div className="text-sm text-gray-500 text-center">Loading top workspaces...</div>
            ) : costsError ? (
              <div className="text-sm text-red-600 text-center">{costsError}</div>
            ) : !topWorkspaces || topWorkspaces.items.length === 0 ? (
              <div className="text-sm text-gray-500 text-center">No high-spend workspaces yet.</div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Workspace
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost (USD)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topWorkspaces.items.map((item) => (
                      <tr key={item.workspaceId} className="border-b border-gray-100">
                        <td className="px-4 py-2 text-xs text-gray-800">{item.workspaceName || item.workspaceId}</td>
                        <td className="px-4 py-2 text-xs text-gray-800">{item.workspaceEmail || "—"}</td>
                        <td className="px-4 py-2 text-right text-xs text-gray-800">${item.totalCostUsd.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Plans</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
              >
                <Plus className="h-3 w-3 mr-1" />
                New Plan
              </Button>
            </div>

            <form onSubmit={onSubmitPlan} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-start mt-2">
              <div className="space-y-1 md:col-span-1">
                <label className="block text-xs font-medium text-gray-700">Name</label>
                <Input
                  name="name"
                  value={formValues.name}
                  onChange={handleFormChange}
                  placeholder="Pro"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">Monthly ($)</label>
                <Input
                  name="priceMonthly"
                  value={formValues.priceMonthly}
                  onChange={handleFormChange}
                  placeholder="99"
                  type="number"
                  step="0.01"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">Yearly ($)</label>
                <Input
                  name="priceYearly"
                  value={formValues.priceYearly}
                  onChange={handleFormChange}
                  placeholder="990"
                  type="number"
                  step="0.01"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">Credits included</label>
                <Input
                  name="creditsIncluded"
                  value={formValues.creditsIncluded}
                  onChange={handleFormChange}
                  placeholder="50000"
                  type="number"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-medium text-gray-700">Features (JSON)</label>
                <textarea
                  name="features"
                  value={formValues.features}
                  onChange={handleFormChange}
                  className="w-full border border-gray-200 rounded-md text-xs px-2 py-1 font-mono h-20 resize-y"
                />
              </div>
              <div className="flex items-end md:col-span-1">
                <Button
                  type="submit"
                  className="w-full h-9 text-xs"
                  disabled={savingPlan}
                >
                  {savingPlan
                    ? "Saving..."
                    : editingPlanId
                    ? "Update Plan"
                    : "Create Plan"}
                </Button>
              </div>
            </form>

            {planError && (
              <p className="text-xs text-red-600 mt-2">{planError}</p>
            )}
          </Card>

          <Card className="p-0 overflow-hidden border-gray-200">
            {loadingPlans ? (
              <div className="p-6 text-center text-sm text-gray-500">
                Loading plans...
              </div>
            ) : plans.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No plans configured yet.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Plan
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pricing
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credits
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Active Subs
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.id} className="border-b border-gray-100">
                        <td className="px-4 py-2">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{plan.name}</span>
                            <span className="text-xs text-gray-500">
                              ID: {plan.id.slice(0, 8)}...
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-700 text-xs">
                          <div className="flex flex-col">
                            <span>
                              {plan.priceMonthly != null ? `$${plan.priceMonthly}/mo` : "Custom"}
                            </span>
                            {plan.priceYearly != null && (
                              <span className="text-[11px] text-gray-500">
                                ${plan.priceYearly}/yr
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-700 text-xs">
                          {plan.creditsIncluded.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-gray-700 text-xs">
                          {plan.activeSubscriptionsCount ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-700 text-xs">
                          {plan.isActive ? "Active" : "Inactive"}
                        </td>
                        <td className="px-4 py-2 text-right text-xs">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => onEditPlan(plan)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => onDeactivatePlan(plan.id)}
                              disabled={!plan.isActive}
                            >
                              Deactivate
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
