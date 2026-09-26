import { authClient } from './auth/client';
import { API_BASE_URL } from './api';
import { getCurrentWorkspaceId } from './knowledgebaseApi';

export interface CallRecord {
  id: string;
  direction: string;
  status: string;
  fromNumber: string | null;
  toNumber: string | null;
  durationSeconds: number | null;
  disconnectReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  agent: { id: string; name: string } | null;
  phoneNumber: { id: string; number: string; provider: string } | null;
}

export interface CallSummary {
  avgDurationSeconds: number;
  transferredCount: number;
  failedCount: number;
  totalCount: number;
}

async function getAuthHeaders(workspaceId: string) {
  const { data: session } = await authClient.getSession();
  const token = session?.user?.id;
  if (!token) throw new Error('No active session');
  return {
    'Content-Type': 'application/json',
    'X-Workspace-ID': workspaceId,
    'workspace-id': workspaceId,
  };
}

export async function listCalls(
  opts: { status?: string; direction?: string; page?: number; pageSize?: number } = {},
  specificWorkspaceId?: string,
): Promise<{ calls: CallRecord[]; total: number; page: number; pageSize: number }> {
  const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
  if (!workspaceId) return { calls: [], total: 0, page: 1, pageSize: 25 };
  const headers = await getAuthHeaders(workspaceId);
  const params = new URLSearchParams({ workspaceId, ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(`${API_BASE_URL}/v1/calls?${params}`, { headers });
  if (!res.ok) throw new Error(`Failed to list calls: ${res.status}`);
  return res.json();
}

export async function getCallSummary(specificWorkspaceId?: string): Promise<CallSummary | null> {
  const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
  if (!workspaceId) return null;
  const headers = await getAuthHeaders(workspaceId);
  const res = await fetch(`${API_BASE_URL}/v1/calls/summary?workspaceId=${workspaceId}`, { headers });
  if (!res.ok) throw new Error(`Failed to load call summary: ${res.status}`);
  return res.json();
}
