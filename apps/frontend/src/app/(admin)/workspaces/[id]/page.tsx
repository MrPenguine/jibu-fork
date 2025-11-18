"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@libs/shadcn-ui/components/ui/card";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Badge } from "@libs/shadcn-ui/components/ui/badge";
import { ArrowLeft, Building2, Users, Bot, AlertTriangle } from "lucide-react";

interface AdminWorkspace {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  isSuspended: boolean;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspensionReason: string | null;
  owner: {
    membershipId: string;
    userId: string | null;
    email: string | null;
  } | null;
  members: Array<{
    id: string;
    userId: string | null;
    email: string | null;
    role: string;
    status: string;
    createdAt: string;
  }>;
  agents: Array<{
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
  }>;
  recentSessions: Array<{
    id: string;
    status: string;
    createdAt: string;
  }>;
  subscription: {
    id: string;
    status: string;
    planName: string | null;
    currentPeriodEnd: string | null;
  } | null;
}

interface AdminWorkspaceUsage {
  workspaceId: string;
  days: number;
  totalsByType: Record<string, number>;
  totalsByProvider: Record<string, number>;
  totalCostInMicroUSD: number;
  totalRecords: number;
  since: string;
}

export default function AdminWorkspaceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workspaceId = params?.id;

  const [workspace, setWorkspace] = React.useState<AdminWorkspace | null>(null);
  const [usage, setUsage] = React.useState<AdminWorkspaceUsage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = React.useState(false);

  React.useEffect(() => {
    if (!workspaceId) return;

    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [wsRes, usageRes] = await Promise.all([
          fetch(`/api/admin/workspaces/${workspaceId}`),
          fetch(`/api/admin/workspaces/${workspaceId}/usage?days=30`),
        ]);

        if (!wsRes.ok) {
          const body = await wsRes.json().catch(() => ({}));
          throw new Error(
            body.error || body.message || "Failed to load workspace",
          );
        }

        if (!usageRes.ok) {
          const body = await usageRes.json().catch(() => ({}));
          throw new Error(
            body.error || body.message || "Failed to load workspace usage",
          );
        }

        const wsJson = await wsRes.json();
        const usageJson = await usageRes.json();

        if (!isMounted) return;
        setWorkspace(wsJson);
        setUsage(usageJson);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load workspace");
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
  }, [workspaceId]);

  const handleSuspendToggle = async () => {
    if (!workspaceId || !workspace) return;

    try {
      setUpdatingStatus(true);
      setError(null);

      const endpoint = workspace.isSuspended
        ? `/api/admin/workspaces/${workspaceId}/unsuspend`
        : `/api/admin/workspaces/${workspaceId}/suspend`;

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error || body.message || "Failed to update workspace status",
        );
      }

      const updated = await response.json();
      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              isSuspended: updated.isSuspended,
              suspendedAt: updated.suspendedAt,
              suspendedBy: updated.suspendedBy ?? prev.suspendedBy,
              suspensionReason: updated.suspensionReason,
            }
          : prev,
      );
    } catch (err: any) {
      setError(err?.message || "Failed to update workspace status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <button
        type="button"
        onClick={() => router.push("/workspaces")}
        className="flex items-center text-xs text-gray-500 hover:text-gray-700 mb-2"
      >
        <ArrowLeft className="h-3 w-3 mr-1" />
        Back to Workspaces
      </button>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <WorkspaceTitleIcon />
            <span>{workspace?.name || "Workspace"}</span>
          </h1>
          {workspace?.email && (
            <p className="text-sm text-gray-600 mt-1">{workspace.email}</p>
          )}
          {workspace && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge
                className={
                  workspace.isSuspended
                    ? "bg-red-100 text-red-700"
                    : "bg-emerald-100 text-emerald-700"
                }
              >
                {workspace.isSuspended ? "Suspended" : "Active"}
              </Badge>
              {workspace.subscription && (
                <Badge className="bg-blue-100 text-blue-700">
                  {workspace.subscription.planName || "Plan"} (
                  {workspace.subscription.status})
                </Badge>
              )}
            </div>
          )}
        </div>
        {workspace && (
          <div className="flex flex-col items-end gap-2">
            <Button
              variant={workspace.isSuspended ? "outline" : "destructive"}
              onClick={handleSuspendToggle}
              disabled={updatingStatus}
              className="h-9 px-3 text-sm"
            >
              {updatingStatus
                ? "Updating..."
                : workspace.isSuspended
                ? "Unsuspend Workspace"
                : "Suspend Workspace"}
            </Button>
            {workspace.isSuspended && workspace.suspensionReason && (
              <div className="flex items-start gap-1 text-xs text-red-700 max-w-xs">
                <AlertTriangle className="h-3 w-3 mt-0.5" />
                <span>{workspace.suspensionReason}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <Card className="p-6 text-sm text-gray-500">Loading workspace...</Card>
      ) : error ? (
        <Card className="p-6 text-sm text-red-600">{error}</Card>
      ) : !workspace ? (
        <Card className="p-6 text-sm text-gray-500">Workspace not found.</Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5 space-y-3 col-span-1">
            <h2 className="text-sm font-semibold text-gray-800">Overview</h2>
            <div className="text-xs text-gray-600 space-y-1">
              <p>
                <span className="font-medium">Created:</span>{" "}
                {new Date(workspace.createdAt).toLocaleString()}
              </p>
              <p>
                <span className="font-medium">Last updated:</span>{" "}
                {new Date(workspace.updatedAt).toLocaleString()}
              </p>
              {workspace.owner && (
                <p>
                  <span className="font-medium">Owner:</span>{" "}
                  {workspace.owner.email || workspace.owner.userId || "Unknown"}
                </p>
              )}
              {usage && (
                <>
                  <p>
                    <span className="font-medium">Usage window:</span>{" "}
                    last {usage.days} days
                  </p>
                  <p>
                    <span className="font-medium">Events:</span>{" "}
                    {usage.totalRecords}
                  </p>
                  <p>
                    <span className="font-medium">Estimated cost:</span>{" "}
                    ${" "}
                    {(usage.totalCostInMicroUSD / 1_000_000).toFixed(4)}
                  </p>
                </>
              )}
            </div>
          </Card>

          <Card className="p-5 space-y-3 col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                Members
              </h2>
            </div>
            {workspace.members.length === 0 ? (
              <p className="text-xs text-gray-500">No members.</p>
            ) : (
              <div className="border border-gray-100 rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Member
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Role
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.members.map((m) => (
                      <tr key={m.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          <span className="text-gray-800">
                            {m.email || m.userId || "Member"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-700 text-xs">
                          {m.role}
                        </td>
                        <td className="px-3 py-2 text-gray-700 text-xs">
                          {m.status}
                        </td>
                        <td className="px-3 py-2 text-gray-700 text-xs">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3 col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Bot className="h-4 w-4 text-gray-500" />
                Agents
              </h2>
            </div>
            {workspace.agents.length === 0 ? (
              <p className="text-xs text-gray-500">No agents.</p>
            ) : (
              <div className="border border-gray-100 rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Agent
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.agents.map((a) => (
                      <tr key={a.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-800">{a.name}</td>
                        <td className="px-3 py-2 text-gray-700 text-xs">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-3 col-span-1 lg:col-span-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Recent Sessions
            </h2>
            {workspace.recentSessions.length === 0 ? (
              <p className="text-xs text-gray-500">No recent sessions.</p>
            ) : (
              <div className="border border-gray-100 rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        ID
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        Started
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.recentSessions.map((s) => (
                      <tr key={s.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-800">{s.id}</td>
                        <td className="px-3 py-2 text-gray-700 text-xs">
                          {s.status}
                        </td>
                        <td className="px-3 py-2 text-gray-700 text-xs">
                          {new Date(s.createdAt).toLocaleString()}
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

function WorkspaceTitleIcon() {
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700">
      <Building2 className="h-4 w-4" />
    </span>
  );
}
