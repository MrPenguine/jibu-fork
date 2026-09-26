import { fetchAPI } from './api';

export interface Contact {
  id: string;
  workspaceId: string;
  externalId: string;
  channel: string;
  displayName?: string | null;
  metadata?: { lastIssue?: string; resolved?: boolean; updatedAt?: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactTimelineEntry {
  type: 'call' | 'chat';
  id: string;
  at: string;
  status?: string | null;
  disconnectReason?: string | null;
}

export interface ContactDetail extends Contact {
  timeline: ContactTimelineEntry[];
}

export interface ContactMemory {
  text: string;
  createdAt: string;
  source: 'call' | 'chat' | 'turn';
}

/** GET /v1/contacts?search= — any authenticated workspace member. */
export async function listContacts(
  search?: string,
  page = 1,
  pageSize = 20,
): Promise<{ contacts: Contact[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set('search', search);
  const result = await fetchAPI(`/v1/contacts?${params.toString()}`);
  return result || { contacts: [], total: 0, page, pageSize };
}

export async function getContact(id: string): Promise<ContactDetail | null> {
  if (!id) return null;
  return fetchAPI(`/v1/contacts/${id}`);
}

export async function getContactMemories(id: string): Promise<ContactMemory[]> {
  if (!id) return [];
  const result = await fetchAPI(`/v1/contacts/${id}/memories`);
  return Array.isArray(result) ? result : [];
}

/** Create (or update the display name of) a persona/contact — used by the
 * floating agent tester's persona picker to let a tester name and reuse
 * personas like "Riley"/"James" across chat and voice test sessions. */
export async function createContact(opts: {
  externalId: string;
  displayName?: string;
  channel?: 'phone' | 'whatsapp' | 'widget';
}): Promise<Contact | null> {
  return fetchAPI('/v1/contacts', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}
