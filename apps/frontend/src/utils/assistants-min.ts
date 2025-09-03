import { fetchAPI } from './api';

export interface AssistantSummary {
  id: string;
  name: string;
}

export async function listAssistantsByAgent(agentId: string, workspaceId?: string): Promise<AssistantSummary[]> {
  if (!agentId) return [];
  const query = new URLSearchParams();
  if (workspaceId) query.set('workspaceId', workspaceId);
  query.set('agentId', agentId);
  const res = await fetchAPI(`/assistants?${query.toString()}`);
  return (res || []).map((a: any) => ({ id: a.id, name: a.name }));
}

export async function createAssistantMinimal(name: string, agentId: string): Promise<AssistantSummary> {
  if (!name?.trim()) throw new Error('Name is required');
  if (!agentId) throw new Error('agentId is required');
  const res = await fetchAPI('/assistants', {
    method: 'POST',
    body: JSON.stringify({ name, agentId })
  });
  return { id: res.id, name: res.name };
}

export interface AssistantDetails {
  id: string;
  name: string;
  description?: string;
  llmProvider?: string;
  llmModel?: string;
  systemPrompt?: string;
  metadata?: { temperature?: number; maxTokens?: number; [k: string]: any } | null;
}

export async function getAssistantById(id: string): Promise<AssistantDetails> {
  if (!id) throw new Error('id is required');
  const res = await fetchAPI(`/assistants/${id}`);
  return res as AssistantDetails;
}

export async function updateAssistant(
  id: string,
  payload: Partial<Pick<AssistantDetails, 'name' | 'description' | 'llmProvider' | 'llmModel' | 'systemPrompt' | 'metadata'>> & { agentId?: string }
): Promise<AssistantDetails> {
  if (!id) throw new Error('id is required');
  const res = await fetchAPI(`/assistants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
  return res as AssistantDetails;
}
