"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card } from "@libs/shadcn-ui/components/ui/card"
import { Building2 } from "lucide-react"

export default function WorkspacesPage() {
  const router = useRouter()
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<{
    items: Array<{
      id: string
      name: string
      email: string | null
      isSuspended: boolean
      createdAt: string
      owner: {
        membershipId: string
        userId: string | null
        email: string | null
      } | null
      membersCount: number
      agentsCount: number
      chatsCount: number
      subscription: {
        id: string
        status: string
        planName: string | null
      } | null
    }>
    page: number
    pageSize: number
    total: number
    totalPages: number
  } | null>(null)

  const pageSize = 20

  React.useEffect(() => {
    let isMounted = true

    const fetchWorkspaces = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams()
        params.set("page", String(page))
        params.set("pageSize", String(pageSize))
        if (search.trim()) {
          params.set("search", search.trim())
        }

        const response = await fetch(`/api/admin/workspaces?${params.toString()}`)

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error || body.message || "Failed to load workspaces")
        }

        const json = await response.json()
        if (!isMounted) return
        setData(json)
      } catch (err: any) {
        if (!isMounted) return
        setError(err?.message || "Failed to load workspaces")
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchWorkspaces()

    return () => {
      isMounted = false
    }
  }, [page, search])

  const onSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setPage(1)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspace Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            View and manage all workspaces on the platform
          </p>
        </div>
        <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="pl-3 pr-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white min-w-[220px]"
            />
          </div>
          <button
            type="submit"
            className="h-8 px-3 text-xs rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          >
            Apply
          </button>
        </form>
      </div>

      <Card className="p-0 overflow-hidden border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Loading workspaces...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">
            {error}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No workspaces found.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Workspace
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Members
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agents
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Messages
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((ws) => (
                  <tr
                    key={ws.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/workspaces/${ws.id}`)}
                  >
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{ws.name}</span>
                        {ws.email && (
                          <span className="text-xs text-gray-500">{ws.email}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-700 text-sm">
                      {ws.owner?.email || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          ws.isSuspended
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {ws.isSuspended ? "Suspended" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {ws.membersCount}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {ws.agentsCount}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {ws.chatsCount}
                    </td>
                    <td className="px-4 py-2 text-gray-700 text-xs">
                      {ws.subscription
                        ? `${ws.subscription.planName || "Plan"} (${ws.subscription.status})`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-600">
              <div>
                Page {data.page} of {data.totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-7 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-700 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="h-7 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-700 disabled:opacity-50"
                  disabled={!data || page >= data.totalPages}
                  onClick={() => setPage((p) => (!data ? p : Math.min(data.totalPages, p + 1)))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
