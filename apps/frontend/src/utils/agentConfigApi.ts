import { fetchAPI } from './api';

export interface AgentChannels {
  chat: boolean;
  whatsapp: boolean;
  voice: boolean;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  ttsProvider: string;
  ttsVoiceId: string;
  sttProvider: string;
  firstMessage: string;
  knowledgeBaseIds: string[];
  toolIds: string[];
  intentIds: string[];
  channels: AgentChannels;
}

export interface WorkspaceTool {
  id: string;
  name: string;
  description?: string;
  type: string;
  enabled: boolean;
}

export type CreatableToolType = 'http.get' | 'http.post' | 'n8n.webhook';

export interface ToolFunctionParameter {
  name: string;
  type: string;
  description?: string;
  required: boolean;
}

export interface WorkspaceToolFull {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  type: string;
  function: { name?: string; description?: string; parameters?: { type: string; properties: Record<string, unknown>; required?: string[] } };
  metadata?: Record<string, unknown> | null;
  credentialId?: string | null;
  enabled: boolean;
  requiresConfirmation: boolean;
  requiredSlots: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateToolPayload {
  name: string;
  description?: string;
  type: CreatableToolType;
  function: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  credentialId?: string;
  requiresConfirmation?: boolean;
  requiredSlots?: string[];
}

export interface Intent {
  id: string;
  workspaceId: string;
  agentId: string | null;
  name: string;
  description?: string | null;
  promptSnippet?: string | null;
  enabled: boolean;
  tools: { toolId: string }[];
}

export interface CreateIntentPayload {
  name: string;
  description?: string;
  promptSnippet?: string;
  agentId?: string;
  toolIds?: string[];
}

export async function getAgentConfig(agentId: string): Promise<AgentConfig> {
  return fetchAPI(`/v1/agents/${agentId}/config`);
}

export async function updateAgentConfig(
  agentId: string,
  config: Partial<AgentConfig>,
): Promise<AgentConfig> {
  return fetchAPI(`/v1/agents/${agentId}/config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function listAgentTools(agentId: string): Promise<WorkspaceTool[]> {
  return fetchAPI(`/v1/agents/${agentId}/available-tools`);
}

export async function getOllamaModels(): Promise<string[]> {
  return fetchAPI(`/v1/agents/ollama/models`);
}

// ── Tool CRUD (full authoring surface — listAgentTools above is the
// read-only attach-picker view) ─────────────────────────────────────────

export async function listWorkspaceTools(): Promise<WorkspaceToolFull[]> {
  return fetchAPI(`/v1/agents/tools`);
}

export async function createTool(payload: CreateToolPayload): Promise<WorkspaceToolFull> {
  return fetchAPI(`/v1/agents/tools`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateTool(
  toolId: string,
  payload: Partial<CreateToolPayload> & { enabled?: boolean },
): Promise<WorkspaceToolFull> {
  return fetchAPI(`/v1/agents/tools/${toolId}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deleteTool(toolId: string): Promise<{ success: boolean }> {
  return fetchAPI(`/v1/agents/tools/${toolId}`, { method: 'DELETE' });
}

// ── Intent CRUD ──────────────────────────────────────────────────────────

export async function listIntents(agentId?: string): Promise<Intent[]> {
  const q = agentId ? `?agentId=${agentId}` : '';
  return fetchAPI(`/v1/agents/intents${q}`);
}

export async function createIntent(payload: CreateIntentPayload): Promise<Intent> {
  return fetchAPI(`/v1/agents/intents`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateIntent(
  intentId: string,
  payload: Partial<CreateIntentPayload> & { enabled?: boolean },
): Promise<Intent> {
  return fetchAPI(`/v1/agents/intents/${intentId}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deleteIntent(intentId: string): Promise<{ success: boolean }> {
  return fetchAPI(`/v1/agents/intents/${intentId}`, { method: 'DELETE' });
}

export interface AgentKnowledgeBase {
  id: string;
  name: string;
  workspaceId: string;
  visibility?: 'AGENT' | 'WORKSPACE';
  createdAt?: string;
  updatedAt?: string;
}

export async function listAgentKnowledgeBases(agentId: string): Promise<AgentKnowledgeBase[]> {
  return fetchAPI(`/v1/agents/${agentId}/knowledge-bases`);
}

export async function linkAgentKnowledgeBase(
  agentId: string,
  knowledgeBaseId: string,
): Promise<AgentKnowledgeBase[]> {
  return fetchAPI(`/v1/agents/${agentId}/knowledge-bases`, {
    method: 'POST',
    body: JSON.stringify({ knowledgeBaseId }),
  });
}

export async function unlinkAgentKnowledgeBase(
  agentId: string,
  knowledgeBaseId: string,
): Promise<AgentKnowledgeBase[]> {
  return fetchAPI(`/v1/agents/${agentId}/knowledge-bases/${knowledgeBaseId}`, {
    method: 'DELETE',
  });
}
