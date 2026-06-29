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
  channels: AgentChannels;
}

export interface WorkspaceTool {
  id: string;
  name: string;
  description?: string;
  type: string;
  enabled: boolean;
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

export interface AgentKnowledgeBase {
  id: string;
  name: string;
  workspaceId: string;
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
