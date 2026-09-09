"use client"

import * as React from "react"
import { Card } from "@libs/shadcn-ui/components/ui/card"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Input } from "@libs/shadcn-ui/components/ui/input"
import { fetchAPI } from "../../../utils/api"

export default function LogsPage() {
  const [filters, setFilters] = React.useState({ action: "", targetType: "", from: "", to: "" })
  const [page, setPage] = React.useState(1)
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const loadLogs = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ page: String(page), pageSize: "25" })
      Object.entries(filters).forEach(([key, value]) => value && params.set(key, value))
      setData(await fetchAPI(`/admin/audit-logs?${params.toString()}`))
    } catch (err: any) {
      setError(err?.message || "Unable to load audit logs")
    } finally {
      setLoading(false)
    }
  }, [filters, page])

  React.useEffect(() => { void loadLogs() }, [loadLogs])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">System Logs & Monitoring</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review platform administrator actions and safe request details.
        </p>
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-5" onSubmit={(event) => {
          event.preventDefault()
          setPage(1)
          void loadLogs()
        }}>
          {(["action", "targetType", "from", "to"] as const).map((field) => (
            <Input
              key={field}
              type={field === "from" || field === "to" ? "date" : "text"}
              placeholder={field === "targetType" ? "Target type" : field === "action" ? "Action" : field === "from" ? "From" : "To"}
              value={filters[field]}
              onChange={(event) => setFilters((current) => ({ ...current, [field]: event.target.value }))}
            />
          ))}
          <Button type="submit">Apply filters</Button>
        </form>
      </Card>

      <Card>
        {error ? (
          <div className="p-12 text-center text-sm text-destructive">{error}</div>
        ) : loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading audit logs…</div>
        ) : !data?.items?.length ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No audit log entries match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead className="border-b bg-background">
                <tr>
                  <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">When</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">Administrator</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">Target</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{item.admin?.fullName || [item.admin?.firstName, item.admin?.lastName].filter(Boolean).join(" ") || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{item.admin?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{item.action}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{item.targetType || "—"} {item.targetId || ""}</td>
                    <td className="max-w-sm px-4 py-3 text-xs text-muted-foreground"><pre className="whitespace-pre-wrap">{JSON.stringify(item.details || {})}</pre></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t p-4 text-sm">
            <span>Page {data.page} of {data.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
              <Button variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
