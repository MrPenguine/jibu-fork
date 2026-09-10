"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, CircleDashed, Loader2, RefreshCw, XCircle } from "lucide-react"
import { Badge } from "@libs/shadcn-ui/components/ui/badge"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Card } from "@libs/shadcn-ui/components/ui/card"
import { fetchAPI } from "../../../utils/api"

type Status = "ok" | "warn" | "fail" | "skipped"
const statusStyles: Record<Status, string> = {
  ok: "border-green-200 bg-green-50 text-green-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  fail: "border-red-200 bg-red-50 text-destructive",
  skipped: "border-border bg-background text-muted-foreground",
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4" />
  if (status === "warn") return <CircleDashed className="h-4 w-4" />
  if (status === "fail") return <XCircle className="h-4 w-4" />
  return <AlertCircle className="h-4 w-4" />
}

export default function SystemChecksPage() {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const runChecks = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setData(await fetchAPI("/admin/system-checks"))
    } catch (err: any) {
      setError(err?.message || "Unable to run system checks")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void runChecks() }, [runChecks])
  const grouped = React.useMemo(() => {
    const checks = data?.checks || []
    return checks.reduce((groups: Record<string, any[]>, check: any) => {
      const group = check.key.includes("embedding") ? "Data consistency" : check.key.includes("provider") ? "Configuration" : "Dependencies"
      ;(groups[group] ||= []).push(check)
      return groups
    }, {})
  }, [data])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Checks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dependency health and platform configuration at a glance.</p>
        </div>
        <Button variant="outline" onClick={() => void runChecks()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Re-run
        </Button>
      </div>
      {error ? <Card className="p-8 text-center text-sm text-destructive">{error}</Card> : loading && !data ? <Card className="p-8 text-center text-sm text-muted-foreground">Running checks…</Card> : (
        <>
          <Card className="flex items-center gap-3 p-4">
            <Badge className={statusStyles[data?.status as Status]}><StatusIcon status={data?.status || "skipped"} /> <span className="ml-1">Overall: {data?.status || "unknown"}</span></Badge>
            <span className="text-sm text-muted-foreground">{data?.checks?.length || 0} checks completed</span>
          </Card>
          {Object.entries(grouped).map(([group, checks]) => (
            <section key={group} className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">{group}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {(checks as any[]).map((check) => (
                  <Card key={check.key} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-foreground">{check.label}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{check.message}</p>
                      </div>
                      <Badge className={statusStyles[check.status as Status]}><StatusIcon status={check.status} /> <span className="ml-1">{check.status}</span></Badge>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">Latency: {check.latencyMs}ms</div>
                    {check.details && <pre className="mt-2 max-h-36 overflow-auto rounded bg-background p-2 text-xs text-muted-foreground">{JSON.stringify(check.details, null, 2)}</pre>}
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
