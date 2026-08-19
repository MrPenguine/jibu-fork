import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { API_BASE_URL } from '../../../../utils/api';

const DEFAULT_WORKSPACE_NAME = 'My Workspace';

interface WorkspaceResponse {
  id?: string;
  workspace?: WorkspaceResponse;
  activeWorkspace?: WorkspaceResponse;
  lastWorkspace?: WorkspaceResponse;
  workspaceId?: string;
  workspaces?: WorkspaceResponse[];
}

function getWorkspaceId(data: WorkspaceResponse | null | undefined): string | undefined {
  const candidates = [
    data?.id,
    data?.workspace?.id,
    data?.activeWorkspace?.id,
    data?.lastWorkspace?.id,
    data?.workspaceId,
  ];

  return candidates.find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.length > 0,
  );
}

function getBackendErrorMessage(label: string, response: Response): string {
  return `${label} failed: ${response.status} ${response.statusText}`;
}

async function parseResponse<T = unknown>(response: Response): Promise<T | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function backendFailure(
  label: string,
  response: Response,
): Promise<NextResponse> {
  return NextResponse.json(
    { error: getBackendErrorMessage(label, response) },
    { status: response.status >= 400 ? response.status : 502 },
  );
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const authHeaders = {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };

    let workspaceId: string | undefined;
    let resolvedWorkspace: WorkspaceResponse | undefined;

    let lastWorkspaceResponse: Response;
    try {
      lastWorkspaceResponse = await fetch(`${API_BASE_URL}/users/last-workspace`, {
        method: 'GET',
        headers: authHeaders,
      });
    } catch (error) {
      console.error('Error resolving last workspace:', error);
      return NextResponse.json(
        { error: 'Unable to resolve your workspace' },
        { status: 502 },
      );
    }

    if (lastWorkspaceResponse.ok) {
      resolvedWorkspace = await parseResponse<WorkspaceResponse>(lastWorkspaceResponse) || undefined;
      workspaceId = getWorkspaceId(resolvedWorkspace);
    } else if (lastWorkspaceResponse.status !== 404) {
      return backendFailure('Last workspace lookup', lastWorkspaceResponse);
    }

    if (!workspaceId) {
      let workspacesResponse: Response;
      try {
        workspacesResponse = await fetch(`${API_BASE_URL}/workspaces`, {
          method: 'GET',
          headers: authHeaders,
        });
      } catch (error) {
        console.error('Error resolving workspaces:', error);
        return NextResponse.json(
          { error: 'Unable to resolve your workspaces' },
          { status: 502 },
        );
      }

      if (!workspacesResponse.ok) {
        return backendFailure('Workspace list lookup', workspacesResponse);
      }

      const workspacesData = await parseResponse<WorkspaceResponse | WorkspaceResponse[]>(
        workspacesResponse,
      );
      const workspaces = Array.isArray(workspacesData)
        ? workspacesData
        : workspacesData?.workspaces;

      if (!Array.isArray(workspaces)) {
        console.error('Workspace list response was not an array');
        return NextResponse.json(
          { error: 'Unable to resolve your workspaces' },
          { status: 502 },
        );
      }

      if (workspaces.length > 0) {
        resolvedWorkspace = workspaces[0];
        workspaceId = getWorkspaceId(resolvedWorkspace);
      } else {
        let createWorkspaceResponse: Response;
        try {
          createWorkspaceResponse = await fetch(`${API_BASE_URL}/workspaces`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ name: DEFAULT_WORKSPACE_NAME }),
          });
        } catch (error) {
          console.error('Error creating default workspace:', error);
          return NextResponse.json(
            { error: 'Unable to create your default workspace' },
            { status: 502 },
          );
        }

        if (!createWorkspaceResponse.ok) {
          return backendFailure(
            'Default workspace creation',
            createWorkspaceResponse,
          );
        }

        resolvedWorkspace = await parseResponse<WorkspaceResponse>(
          createWorkspaceResponse,
        ) || undefined;
        workspaceId = getWorkspaceId(resolvedWorkspace);
      }
    }

    if (!workspaceId) {
      console.error('Workspace resolution returned no workspace ID');
      return NextResponse.json(
        { error: 'Unable to resolve your workspace' },
        { status: 502 },
      );
    }

    const contextHeaders = {
      ...authHeaders,
      'X-Workspace-ID': workspaceId,
      'workspace-id': workspaceId,
    };

    let contextResponse: Response;
    try {
      contextResponse = await fetch(`${API_BASE_URL}/users/context`, {
        method: 'GET',
        headers: contextHeaders,
      });
    } catch (error) {
      console.error('Error fetching user context:', error);
      return NextResponse.json(
        { error: 'Unable to fetch your user context' },
        { status: 502 },
      );
    }

    if (!contextResponse.ok) {
      return backendFailure('User context lookup', contextResponse);
    }

    const contextData = await parseResponse<WorkspaceResponse>(contextResponse);
    return NextResponse.json({
      ...(contextData || {}),
      workspaceId: contextData?.workspaceId || workspaceId,
      workspace: contextData?.workspace || resolvedWorkspace?.workspace || resolvedWorkspace,
    });
  } catch (error) {
    console.error('Error in get-user-context:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}