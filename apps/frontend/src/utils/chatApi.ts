import { fetchAPI } from './api';

const safeISO = (date: any) => {
  if (!date) {
    return new Date().toISOString();
  }
  const d = new Date(date);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  sequenceId: number;
  createdAt: string;
  updatedAt: string;
  type?: string;
}

export interface Chat {
  id: string;
  name?: string;
  sessionId: string;
  sessionType: string;
  assistantId?: string;
  agentId?: string;
  workflowId?: string;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * List all chats for an assistant or agent
 * @param id The ID of the assistant or agent
 * @param entityType Type of entity to fetch chats for ('assistant' or 'agent')
 * @param sessionType The type of session (default: 'chat')
 * @param specificOrgId Optional: Provide a specific organization ID, otherwise uses active org
 */
export async function listChats(
  id: string,
  entityType: 'assistant' | 'agent' = 'assistant',
  sessionType: string = 'chat',
  _specificWorkspaceId?: string
): Promise<Chat[]> {
  if (entityType === 'agent') {
    // Backend chats are keyed by agentId and workspace via auth headers
    const params = new URLSearchParams({ agentId: id, sessionType });
    return fetchAPI(`/v1/chats?${params.toString()}`);
  }

  // Assistant-scoped chats are not used in the canvas flow; return empty for now
  return [];
}

/**
 * Get messages for a chat
 * @param chatId The ID of the chat
 * @param specificOrgId Optional: Provide a specific organization ID, otherwise uses active org
 */
export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  if (!chatId) return [];
  const result = await fetchAPI(`/v1/chats/${chatId}/messages`, {
    method: 'GET',
  });
  return Array.isArray(result)
    ? result.map((m: any) => ({
        id: String(m.id),
        content: m.content,
        role: m.role,
        sequenceId: m.sequenceId,
        createdAt: safeISO(m.createdAt),
        updatedAt: safeISO(m.updatedAt),
        type: m.type || 'text',
      }))
    : [];
}

/**
 * Create a new chat
 * @param assistantId The ID of the assistant
 * @param name Optional name for the chat
 * @param specificOrgId Optional: Provide a specific organization ID, otherwise uses active org
 * @param isAgent Whether the chat is for an agent or not
 */
export async function createChat(
  assistantId: string,
  name?: string,
  _specificWorkspaceId?: string,
  isAgent: boolean = false,
  workflowId?: string
): Promise<Chat | null> {
  const body: any = {
    name,
    sessionType: 'chat',
  };

  if (isAgent) {
    body.agentId = assistantId;
  } else {
    body.assistantId = assistantId;
  }

  if (workflowId) {
    body.workflowId = workflowId;
  }

  const created = await fetchAPI('/v1/chats', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!created) return null;

  const chat: Chat = {
    id: String(created.id),
    name: created.name || name,
    sessionId: created.sessionId,
    sessionType: created.sessionType,
    assistantId: created.assistantId || undefined,
    agentId: created.agentId || undefined,
    workflowId: created.workflowId || undefined,
    workspaceId: created.workspaceId || undefined,
    createdAt: safeISO(created.createdAt),
    updatedAt: safeISO(created.updatedAt),
  };

  return chat;
}

/**
 * Send a message to a chat
 * @param chatId The ID of the chat
 * @param content The message content
 * @param role The role of the sender ('user' or 'assistant')
 * @param specificOrgId Optional: Provide a specific organization ID, otherwise uses active org
 */
export async function sendChatMessage(
  chatId: string,
  content: string,
  role: 'user' | 'assistant'
): Promise<ChatMessage | null> {
  if (!chatId) {
    console.warn('[sendChatMessage] Missing chatId, skipping');
    return null;
  }

  // Fetch existing messages to compute next sequenceId for diagnostics
  const existing = await getChatMessages(chatId);
  const sequenceId = existing.length;

  const body = {
    content,
    role,
    sequenceId,
    type: 'text',
  };

  const created = await fetchAPI(`/v1/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!created) return null;

  const message: ChatMessage = {
    id: String(created.id),
    content: created.content,
    role: created.role,
    sequenceId: created.sequenceId,
    createdAt: safeISO(created.createdAt),
    updatedAt: safeISO(created.updatedAt),
    type: created.type || 'text',
  };

  return message;
}

/**
 * Send a user message and return BOTH the persisted user message and the
 * synchronous assistant reply produced by the single-brain runtime
 * (agent-backed chats answer inline; see ChatsService.createMessage).
 */
export async function sendUserMessageWithReply(
  chatId: string,
  content: string
): Promise<{ user: ChatMessage; assistant: ChatMessage | null }> {
  const existing = await getChatMessages(chatId);
  const sequenceId = existing.length;

  const created = await fetchAPI(`/v1/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, role: 'user', sequenceId, type: 'text' }),
  });

  const toMsg = (m: any): ChatMessage => ({
    id: String(m.id),
    content: m.content,
    role: m.role,
    sequenceId: m.sequenceId,
    createdAt: safeISO(m.createdAt),
    updatedAt: safeISO(m.updatedAt),
    type: m.type || 'text',
  });

  return {
    user: toMsg(created),
    assistant: created?.assistantMessage ? toMsg(created.assistantMessage) : null,
  };
}

/**
 * Update a chat's name
 * @param chatId The ID of the chat
 * @param name The new name for the chat
 * @param specificOrgId Optional: Provide a specific organization ID, otherwise uses active org
 */
export async function updateChatName(
  chatId: string,
  name: string
): Promise<boolean> {
  if (!chatId) return false;
  await fetchAPI(`/v1/chats/${chatId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  return true;
}

/**
 * Delete a chat
 * @param chatId The ID of the chat
 * @param specificWorkspaceId Optional: Provide a specific workspace ID, otherwise uses active workspace
 */
export async function deleteChat(chatId: string): Promise<boolean> {
  if (!chatId) return false;
  await fetchAPI(`/v1/chats/${chatId}`, {
    method: 'DELETE',
  });
  return true;
}