import { createClient } from './supabase/client';

// Get the current workspace ID (preferred)
export function getCurrentWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Prefer the new workspace key
    let wsId = localStorage.getItem('activeWorkspaceId');
    if (!wsId) {
      // Backward-compat: read legacy org keys and migrate
      wsId = localStorage.getItem('activeOrgId') || localStorage.getItem('activeOrganizationId');
      if (wsId) {
        try {
          localStorage.setItem('activeWorkspaceId', wsId);
        } catch (_) {
          // ignore storage errors
        }
      }
    }
    if (!wsId) {
      console.warn('[auth] No workspace ID available');
    }
    return wsId;
  } catch (error) {
    console.error('[auth] Error getting workspace ID:', error);
    return null;
  }
}

// Backward-compat wrapper: treat "organization" as workspace
export function getCurrentOrganizationId(): string | null {
  const id = getCurrentWorkspaceId();
  if (!id) {
    console.warn('[auth] getCurrentOrganizationId is deprecated. No workspace ID available.');
  }
  return id;
}

// Get authorization headers with token and workspace ID (preferred)
export async function getWorkspaceAuthHeaders() {
  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) {
    throw new Error('No workspace ID available');
  }
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('No authentication token available');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Workspace-Id': workspaceId,
  } as Record<string, string>;
}

// Backward-compat wrapper: include legacy org headers too, but prefer workspace header
export async function getAuthHeaders() {
  const headers = await getWorkspaceAuthHeaders();
  const workspaceId = headers['X-Workspace-Id'];
  return {
    ...headers,
    // Legacy headers for endpoints not yet migrated
    'X-Organization-ID': workspaceId,
    'organization-id': workspaceId,
  };
}
