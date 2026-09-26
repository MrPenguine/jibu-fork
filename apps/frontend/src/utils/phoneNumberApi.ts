import { authClient } from './auth/client';
import { API_BASE_URL } from './api';
import { getCurrentWorkspaceId } from './knowledgebaseApi';

export interface PhoneNumber {
  id: string;
  workspaceId: string | null;
  number: string;
  country: string;
  provider: string;
  capabilities: string[];
  status: string;
  agentId: string | null;
  agent: { id: string; name: string } | null;
  claimedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCatalogEntry {
  provider: string;
  label: string;
  connected: boolean;
  liveSearch: boolean;
}

export interface AvailableTwilioNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  isoCountry: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
}

async function getAuthHeaders(workspaceId?: string) {
  const { data: session } = await authClient.getSession();
  const token = session?.user?.id;
  if (!token) throw new Error('No active session');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (workspaceId) {
    headers['X-Workspace-ID'] = workspaceId;
    headers['workspace-id'] = workspaceId;
  }
  return headers;
}

export async function getProviderCatalog(): Promise<ProviderCatalogEntry[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE_URL}/v1/phone-numbers/providers`, { headers });
  if (!res.ok) throw new Error(`Failed to load provider catalog: ${res.status}`);
  return res.json();
}

export async function browsePool(country?: string, provider?: string): Promise<PhoneNumber[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (country) params.set('country', country);
  if (provider) params.set('provider', provider);
  const qs = params.toString();
  const res = await fetch(`${API_BASE_URL}/v1/phone-numbers/pool${qs ? `?${qs}` : ''}`, { headers });
  if (!res.ok) throw new Error(`Failed to browse pool: ${res.status}`);
  return res.json();
}

export async function searchTwilio(country: string, areaCode?: string): Promise<AvailableTwilioNumber[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ country, ...(areaCode ? { areaCode } : {}) });
  const res = await fetch(`${API_BASE_URL}/v1/phone-numbers/search-twilio?${params}`, { headers });
  if (!res.ok) throw new Error(`Failed to search Twilio: ${res.status}`);
  return res.json();
}

export async function listOwnedNumbers(specificWorkspaceId?: string): Promise<PhoneNumber[]> {
  const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
  if (!workspaceId) return [];
  const headers = await getAuthHeaders(workspaceId);
  const res = await fetch(`${API_BASE_URL}/v1/phone-numbers?workspaceId=${workspaceId}`, { headers });
  if (!res.ok) throw new Error(`Failed to list owned numbers: ${res.status}`);
  return res.json();
}

/** Claim either an already-pooled number (phoneNumberId) or live-purchase a
 * Twilio search result (twilioNumber) — never both. */
export async function claimPhoneNumber(
  opts: { phoneNumberId?: string; twilioNumber?: string; twilioCountry?: string; agentId?: string },
  specificWorkspaceId?: string,
): Promise<PhoneNumber> {
  const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
  if (!workspaceId) throw new Error('No active workspace');
  const headers = await getAuthHeaders(workspaceId);
  const res = await fetch(`${API_BASE_URL}/v1/phone-numbers/claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ workspaceId, ...opts }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Failed to claim number: ${res.status}`);
  }
  return res.json();
}

export async function releasePhoneNumber(id: string, specificWorkspaceId?: string): Promise<void> {
  const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
  if (!workspaceId) throw new Error('No active workspace');
  const headers = await getAuthHeaders(workspaceId);
  const res = await fetch(`${API_BASE_URL}/v1/phone-numbers/${id}/release?workspaceId=${workspaceId}`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error(`Failed to release phone number: ${res.status}`);
}

export async function assignAgent(id: string, agentId: string | null, specificWorkspaceId?: string): Promise<PhoneNumber> {
  const workspaceId = getCurrentWorkspaceId(specificWorkspaceId);
  if (!workspaceId) throw new Error('No active workspace');
  const headers = await getAuthHeaders(workspaceId);
  const res = await fetch(`${API_BASE_URL}/v1/phone-numbers/${id}/assign-agent?workspaceId=${workspaceId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ agentId }),
  });
  if (!res.ok) throw new Error(`Failed to assign agent: ${res.status}`);
  return res.json();
}
