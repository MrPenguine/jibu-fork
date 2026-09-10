"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card } from "@libs/shadcn-ui/components/ui/card"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Users, Search, Filter, UserPlus } from "lucide-react"

export default function UsersPage() {
  const router = useRouter()
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<{
    items: Array<{
      id: string
      email: string
      fullName: string | null
      isAdmin: boolean
      isSuspended: boolean
      createdAt: string
      lastSignInAt: string | null
      membershipsCount: number
      apiKeysCount: number
    }>
    page: number
    pageSize: number
    total: number
    totalPages: number
  } | null>(null)

  const pageSize = 20

  React.useEffect(() => {
    let isMounted = true

    const fetchUsers = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams()
        params.set("page", String(page))
        params.set("pageSize", String(pageSize))
        if (search.trim()) {
          params.set("search", search.trim())
        }

        const response = await fetch(`/api/admin/users?${params.toString()}`)

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error || body.message || "Failed to load users")
        }

        const json = await response.json()
        if (!isMounted) return
        setData(json)
      } catch (err: any) {
        if (!isMounted) return
        setError(err?.message || "Failed to load users")
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchUsers()

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
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all users across the platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
                className="pl-8 pr-2 py-1.5 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-card"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              className="h-8 px-3 text-xs border-border"
            >
              <Filter className="h-3 w-3 mr-1" />
              Apply
            </Button>
          </form>
          <Button className="bg-primary hover:bg-primary/90 h-9 px-3 text-sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card className="p-0 overflow-hidden border-border">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading users...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-destructive">
            {error}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No users found.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Workspaces
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    API Keys
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Last Sign-in
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 hover:bg-background cursor-pointer"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {user.fullName || user.email}
                        </span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {user.isAdmin && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent text-primary">
                            Admin
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.isSuspended
                              ? "bg-red-100 text-destructive"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {user.isSuspended ? "Suspended" : "Active"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {user.membershipsCount}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {user.apiKeysCount}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {user.lastSignInAt
                        ? new Date(user.lastSignInAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-background text-xs text-muted-foreground">
              <div>
                Page {data.page} of {data.totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 px-2 text-xs border-border"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 px-2 text-xs border-border"
                  disabled={!data || page >= data.totalPages}
                  onClick={() => setPage((p) => (!data ? p : Math.min(data.totalPages, p + 1)))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
