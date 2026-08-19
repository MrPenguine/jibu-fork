import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { API_BASE_URL } from '../../../../utils/api';

const DEFAULT_WORKSPACE_NAME = 'My Workspace';
const PROVISIONING_RETRY_MESSAGE =
  'User provisioning in progress. Please retry shortly.';
const PROVISIONING_RETRY_DELAYS_MS = [200, 400, 800, 1200];

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

async function parseResponse<T = unknown>(response: Response): Promise<T | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

class WorkspaceResolutionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly provisioningInProgress = false,
  ) {
    super(message);
    this.name = 'WorkspaceResolutionError';
  }
}

interface WorkspaceResolution {
  contextData: WorkspaceResponse | null;
  resolvedWorkspace?: WorkspaceResponse;
  workspaceId: string;
}

const workspaceResolutionInFlight = new Map<
  string,
  Promise<WorkspaceResolution>
>();

function getResponseMessage(data: unknown): string | undefined {
  if (typeof data === 'string') {
    return data;
  }

  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const message = (data as { message?: unknown }).message;
  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(' ');
  }

  return undefined;
}

async function throwBackendFailure(
  label: string,
  response: Response,
): Promise<never> {
  let responseMessage: string | undefined;
  try {
    responseMessage = getResponseMessage(await response.clone().json());
  } catch {
    responseMessage = undefined;
  }

  throw new WorkspaceResolutionError(
    `${label} failed: ${response.status} ${response.statusText}`,
    response.status >= 400 ? response.status : 502,
    response.status === 401 &&
      responseMessage?.includes(PROVISIONING_RETRY_MESSAGE) === true,
  );
}

async function fetchWorkspaceList(
  authHeaders: Record<string, string>,
): Promise<WorkspaceResponse[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/workspaces`, {
      method: 'GET',
      headers: authHeaders,
    });
  } catch (error) {
    console.error('Error resolving workspaces:', error);
    throw new WorkspaceResolutionError(
      'Unable to resolve your workspaces',
      502,
    );
  }

  if (!response.ok) {
    await throwBackendFailure('Workspace list lookup', response);
  }

  const data = await parseResponse<WorkspaceResponse | WorkspaceResponse[]>(
    response,
  );
  const workspaces = Array.isArray(data) ? data : data?.workspaces;
  if (!Array.isArray(workspaces)) {
    console.error('Workspace list response was not an array');
    throw new WorkspaceResolutionError(
      'Unable to resolve your workspaces',
      502,
    );
  }

  return workspaces;
}

async function resolveWorkspaceContextOnce(
  accessToken: string,
): Promise<WorkspaceResolution> {
  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
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
    throw new WorkspaceResolutionError(
      'Unable to resolve your workspace',
      502,
    );
  }

  if (lastWorkspaceResponse.ok) {
    resolvedWorkspace =
      (await parseResponse<WorkspaceResponse>(lastWorkspaceResponse)) ||
      undefined;
    workspaceId = getWorkspaceId(resolvedWorkspace);
  } else if (lastWorkspaceResponse.status !== 404) {
    await throwBackendFailure('Last workspace lookup', lastWorkspaceResponse);
  }

  if (!workspaceId) {
    let workspaces = await fetchWorkspaceList(authHeaders);

    if (workspaces.length > 0) {
      resolvedWorkspace = workspaces[0];
      workspaceId = getWorkspaceId(resolvedWorkspace);
    } else {
      // Re-check immediately before creating so a workspace provisioned by a
      // racing request is reused instead of creating another one.
      workspaces = await fetchWorkspaceList(authHeaders);
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
          throw new WorkspaceResolutionError(
            'Unable to create your default workspace',
            502,
          );
        }

        if (!createWorkspaceResponse.ok) {
          await throwBackendFailure(
            'Default workspace creation',
            createWorkspaceResponse,
          );
        }

        resolvedWorkspace =
          (await parseResponse<WorkspaceResponse>(createWorkspaceResponse)) ||
          undefined;
        workspaceId = getWorkspaceId(resolvedWorkspace);
      }
    }
  }

  if (!workspaceId) {
    console.error('Workspace resolution returned no workspace ID');
    throw new WorkspaceResolutionError(
      'Unable to resolve your workspace',
      502,
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
    throw new WorkspaceResolutionError(
      'Unable to fetch your user context',
      502,
    );
  }

  if (!contextResponse.ok) {
    await throwBackendFailure('User context lookup', contextResponse);
  }

  const contextData = await parseResponse<WorkspaceResponse>(contextResponse);
  return {
    contextData,
    resolvedWorkspace,
    workspaceId,
  };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function resolveWorkspaceContext(
  accessToken: string,
): Promise<WorkspaceResolution> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await resolveWorkspaceContextOnce(accessToken);
    } catch (error) {
      const retryDelay = PROVISIONING_RETRY_DELAYS_MS[attempt];
      if (
        !(error instanceof WorkspaceResolutionError) ||
        !error.provisioningInProgress ||
        retryDelay === undefined
      ) {
        throw error;
      }

      await wait(retryDelay);
    }
  }
}

function getWorkspaceResolution(
  userId: string,
  accessToken: string,
): Promise<WorkspaceResolution> {
  const existing = workspaceResolutionInFlight.get(userId);
  if (existing) {
    return existing;
  }

  const resolution = resolveWorkspaceContext(accessToken).finally(() => {
    workspaceResolutionInFlight.delete(userId);
  });
  workspaceResolutionInFlight.set(userId, resolution);
  return resolution;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token || !session.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    try {
      const resolution = await getWorkspaceResolution(
        session.user.id,
        session.access_token,
      );
      const { contextData, resolvedWorkspace, workspaceId } = resolution;
      return NextResponse.json({
        ...(contextData || {}),
        workspaceId: contextData?.workspaceId || workspaceId,
        workspace:
          contextData?.workspace ||
          resolvedWorkspace?.workspace ||
          resolvedWorkspace,
      });
    } catch (error) {
      if (error instanceof WorkspaceResolutionError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }

      console.error('Error resolving user context:', error);
      return NextResponse.json(
        { error: 'An unexpected error occurred' },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Error in get-user-context:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}