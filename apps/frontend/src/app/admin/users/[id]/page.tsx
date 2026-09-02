"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@libs/shadcn-ui/components/ui/card";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Badge } from "@libs/shadcn-ui/components/ui/badge";
import { ArrowLeft, Shield, KeyRound, AlertTriangle, Users } from "lucide-react";
import { useApi } from "../../../../utils/apiContext";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  imageUrl: string | null;
  isAdmin: boolean;
  adminRole: string | null;
  isSuspended: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  workspaces: Array<{
    id: string;
    name: string | null;
    role: string;
    status: string;
    email: string | null;
  }>;
  apiKeys: Array<{
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    workspaceId: string | null;
    revoked: boolean;
    lastUsedAt: string | null;
    createdAt: string;
  }>;
}

interface AdminUserStats {
  workspaces: number;
  apiKeys: number;
  invitationsSent: number;
  lastSignInAt: string | null;
  joinedAt: string;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params?.id;
  const { user: currentUser } = useApi();

  const [user, setUser] = React.useState<AdminUser | null>(null);
  const [stats, setStats] = React.useState<AdminUserStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = React.useState(false);
  const [updatingRole, setUpdatingRole] = React.useState(false);

  React.useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [userRes, statsRes] = await Promise.all([
          fetch(`/api/admin/users/${userId}`),
          fetch(`/api/admin/users/${userId}/stats`),
        ]);

        if (!userRes.ok) {
          const body = await userRes.json().catch(() => ({}));
          throw new Error(body.error || body.message || "Failed to load user");
        }

        if (!statsRes.ok) {
          const body = await statsRes.json().catch(() => ({}));
          throw new Error(body.error || body.message || "Failed to load user stats");
        }

        const userJson = await userRes.json();
        const statsJson = await statsRes.json();

        if (!isMounted) return;
        setUser(userJson);
        setStats(statsJson);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load user");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleSuspendToggle = async () => {
    if (!userId || !user) return;

    try {
      setUpdatingStatus(true);
      setError(null);

      const endpoint = user.isSuspended
        ? `/api/admin/users/${userId}/unsuspend`
        : `/api/admin/users/${userId}/suspend`;

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || body.message || "Failed to update user status");
      }

      const updated = await response.json();
      setUser((prev) =>
        prev
          ? {
              ...prev,
              isSuspended: updated.isSuspended,
              suspendedAt: updated.suspendedAt,
              suspensionReason: updated.suspensionReason,
            }
          : prev,
      );
    } catch (err: any) {
      const message = err?.message || "Failed to update user status";
      setError(message);
      toast({
        title: "Could not update user status",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRoleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!userId || !user) return;

    const role = event.target.value;
    const currentRole = user.adminRole || (user.isAdmin ? "admin" : "user");
    if (role === currentRole) return;
    if (
      !window.confirm(
        `Change ${displayName}'s role from ${currentRole} to ${role}?`,
      )
    ) {
      event.target.value = currentRole;
      return;
    }

    try {
      setUpdatingRole(true);
      setError(null);
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || body.message || "Failed to update user role");
      }

      const updated = await response.json();
      setUser((prev) =>
        prev
          ? {
              ...prev,
              adminRole: updated.adminRole,
              isAdmin: updated.isAdmin,
            }
          : prev,
      );
      toast({ title: `User role changed to ${role}` });
    } catch (err: any) {
      const message = err?.message || "Failed to update user role";
      setError(message);
      toast({
        title: "Could not update user role",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUpdatingRole(false);
    }
  };

  const displayName =
    user?.fullName ||
    (user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || user?.email || "User");
  const isOwnAccount = Boolean(currentUser?.id && currentUser.id === user?.id);
  const currentRole = user?.adminRole || (user?.isAdmin ? "admin" : "user");

  return (
    <div className="p-6 space-y-6">
      <button
        type="button"
        onClick={() => router.push("/admin/users")}
        className="flex items-center text-xs text-muted-foreground hover:text-foreground mb-2"
      >
        <ArrowLeft className="h-3 w-3 mr-1" />
        Back to Users
      </button>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UsersTitleIcon />
            <span>{displayName}</span>
          </h1>
          {user?.email && (
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
          )}
          {user && (
            <div className="mt-2 flex flex-wrap gap-2">
              {user.isAdmin && (
                <Badge variant="info">
                  <Shield className="h-3 w-3 mr-1" />
                  {currentRole}
                </Badge>
              )}
              <Badge
                variant={user.isSuspended ? "danger" : "success"}
              >
                {user.isSuspended ? "Suspended" : "Active"}
              </Badge>
            </div>
          )}
        </div>
        {user && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor="admin-role" className="text-xs font-medium text-muted-foreground">
                Role
              </label>
              <select
                id="admin-role"
                value={currentRole}
                onChange={handleRoleChange}
                disabled={isOwnAccount || updatingRole || updatingStatus}
                title={
                  isOwnAccount
                    ? "You cannot change your own admin role"
                    : "Change user role"
                }
                className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
            <Button
              variant={user.isSuspended ? "outline" : "destructive"}
              onClick={handleSuspendToggle}
              disabled={isOwnAccount || updatingStatus || updatingRole}
              title={
                isOwnAccount
                  ? "You cannot suspend your own account"
                  : "Suspend or unsuspend this user"
              }
              className="h-9 px-3 text-sm"
            >
              {updatingStatus
                ? "Updating..."
                : user.isSuspended
                ? "Unsuspend User"
                : "Suspend User"}
            </Button>
            {user.isSuspended && user.suspensionReason && (
              <div className="flex items-start gap-1 text-xs text-destructive max-w-xs">
                <AlertTriangle className="h-3 w-3 mt-0.5" />
                <span>{user.suspensionReason}</span>
              </div>
            )}
            {isOwnAccount && (
              <p className="text-xs text-muted-foreground max-w-xs text-right">
                You cannot suspend or change the role of your own account.
              </p>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading user...</Card>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      ) : !user ? (
        <Card className="p-6 text-sm text-muted-foreground">User not found.</Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5 space-y-3 col-span-1">
            <h2 className="text-sm font-semibold text-foreground">
              Overview
            </h2>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Joined:</span>{" "}
                {new Date(user.createdAt).toLocaleString()}
              </p>
              <p>
                <span className="font-medium">Last sign-in:</span>{" "}
                {user.lastSignInAt
                  ? new Date(user.lastSignInAt).toLocaleString()
                  : "—"}
              </p>
              {stats && (
                <>
                  <p>
                    <span className="font-medium">Workspaces:</span>{" "}
                    {stats.workspaces}
                  </p>
                  <p>
                    <span className="font-medium">API Keys:</span>{" "}
                    {stats.apiKeys}
                  </p>
                  <p>
                    <span className="font-medium">Invitations Sent:</span>{" "}
                    {stats.invitationsSent}
                  </p>
                </>
              )}
            </div>
          </Card>

          <Card className="p-5 space-y-3 col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Workspaces
              </h2>
            </div>
            {user.workspaces.length === 0 ? (
              <p className="text-xs text-muted-foreground">No workspaces.</p>
            ) : (
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-background">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Workspace
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Role
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.workspaces.map((w) => (
                      <tr key={w.id} className="border-t border-border">
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {w.name || "Workspace"}
                            </span>
                            {w.email && (
                              <span className="text-[11px] text-muted-foreground">
                                {w.email}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-foreground text-xs">
                          {w.role}
                        </td>
                        <td className="px-3 py-2 text-foreground text-xs">
                          {w.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3 col-span-1 lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                API Keys
              </h2>
            </div>
            {user.apiKeys.length === 0 ? (
              <p className="text-xs text-muted-foreground">No API keys.</p>
            ) : (
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-background">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Prefix
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Workspace
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Last used
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.apiKeys.map((k) => (
                      <tr key={k.id} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground">{k.name}</td>
                        <td className="px-3 py-2 text-foreground">{k.prefix}</td>
                        <td className="px-3 py-2 text-foreground">
                          {k.workspaceId || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={k.revoked ? "danger" : "success"}>
                            {k.revoked ? "Revoked" : "Active"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-foreground">
                          {k.lastUsedAt
                            ? new Date(k.lastUsedAt).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function UsersTitleIcon() {
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent text-primary">
      <Users className="h-4 w-4" />
    </span>
  );
}
