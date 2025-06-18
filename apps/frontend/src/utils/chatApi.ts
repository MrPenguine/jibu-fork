import { createClient } from './supabase/client';
import { getActiveOrgId } from './fileApi';
import { fetchAPI, API_BASE_URL } from './api';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  sequenceId: number;
  createdAt: string;
  updatedAt: string;
  type: string;
}

export interface Chat {
  id: string;
  name?: string;
  sessionId: string;
  sessionType: string;
  assistantId: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
}

/**
 * Get authorization headers with token and organization ID
 */
async function getAuthHeaders(orgId: string) {
  const supabase = createClient();
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  
  if (!token) {
    throw new Error('No authentication token available');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Organization-Id': orgId
  };
}

/**
 * Get the current organization ID or use the provided one
 */
function getCurrentOrganizationId(specificOrgId?: string): string | null {
  // Prioritize the specificOrgId if provided
  if (specificOrgId) {
    console.log(`[getCurrentOrganizationId] Using provided specific organization ID: ${specificOrgId}`);
    return specificOrgId;
  }
  
  // Try to get organization ID from local storage or other sources
  const orgId = getActiveOrgId();
  
  if (orgId) {
    console.log(`[getCurrentOrganizationId] Using organization ID from active context: ${orgId}`);
  } else {
    console.warn('[getCurrentOrganizationId] No organization ID available from any source');
  }
  
  return orgId;
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
  specificOrgId?: string
): Promise<Chat[]> {
  try {
    // Use the provided specificOrgId or get from getCurrentOrganizationId
    const organizationId = getCurrentOrganizationId(specificOrgId);
    
    if (!organizationId) {
      console.warn('[listChats] No organization ID available, results may be limited');
      return [];
    }
    
    console.log(`[listChats] Fetching chats for ${entityType}: ${id} with organization: ${organizationId}`);
    
    try {
      // Request based on entity type
      const queryParam = entityType === 'agent' ? 'agentId' : 'assistantId';
      const response = await fetchAPI(`/v1/chats?${queryParam}=${id}`);
      
      if (!Array.isArray(response)) {
        console.error('[listChats] Expected array of chats but got:', typeof response);
        return [];
      }
      
      // Ensure we're getting only chats for this entity
      const filteredChats = response.filter(chat => 
        chat && (entityType === 'agent' ? chat.agentId === id : chat.assistantId === id)
      );
      
      console.log(`[listChats] Found ${filteredChats.length} chats for ${entityType} ${id}`);
      return filteredChats;
    } catch (error) {
      // If we get a 404, it might mean that no chats exist yet, which is not an error
      if (error instanceof Error && error.message.includes('404')) {
        console.log('[listChats] No chats found for this assistant - This is normal for new assistants');
        return [];
      }
      
      console.error(`[listChats] Failed to fetch chats:`, error);
      return [];
    }
  } catch (error) {
    console.error('[listChats] Error listing chats:', error);
    return [];
  }
}

/**
 * Get messages for a chat
 * @param chatId The ID of the chat
 * @param specificOrgId Optional: Provide a specific organization ID, otherwise uses active org
 */
export async function getChatMessages(
  chatId: string,
  specificOrgId?: string
): Promise<ChatMessage[]> {
  try {
    // Don't try to fetch messages for fallback chats
    if (!chatId || (chatId && chatId.startsWith('chat-'))) {
      console.log('[getChatMessages] Using fallback chat ID, skipping message fetch');
      
      // For fallback chats, we might have stored messages in localStorage
      const localMessages = localStorage.getItem(`chat_messages_${chatId}`);
      if (localMessages) {
        try {
          return JSON.parse(localMessages);
        } catch (e) {
          console.error('[getChatMessages] Error parsing local messages:', e);
          return [];
        }
      }
      
      return [];
    }
    
    try {
      // Add a cache buster to prevent browser caching issues
      const cacheBuster = Date.now();
      const messagesData = await fetchAPI(`/v1/chats/${chatId}/messages?_=${cacheBuster}`);
      
      if (!Array.isArray(messagesData)) {
        console.error('[getChatMessages] Expected array of messages but got:', typeof messagesData);
        return [];
      }
      
      console.log(`[getChatMessages] Fetched ${messagesData.length} messages for chat ${chatId}`);
      
      // Deduplicate messages by ID to prevent duplicates
      const messagesMap: Record<string, ChatMessage> = {};
      messagesData.forEach((msg: any) => {
        if (msg && msg.id) {
          messagesMap[msg.id] = msg as ChatMessage;
        }
      });
      
      const uniqueMessages: ChatMessage[] = Object.values(messagesMap);
      
      // Store a backup copy in localStorage
      if (uniqueMessages.length > 0) {
        localStorage.setItem(`chat_messages_${chatId}`, JSON.stringify(uniqueMessages));
      }
      
      return uniqueMessages;
    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          console.warn('[getChatMessages] Authentication required to fetch chat messages');
        } else if (error.message.includes('500')) {
          console.error('[getChatMessages] Server error when fetching messages. Database might be disconnected.');
        } else {
          console.error(`[getChatMessages] Failed to fetch chat messages:`, error);
        }
      }
      
      return [];
    }
  } catch (error) {
    console.error('[getChatMessages] Error fetching chat messages:', error);
    return [];
  }
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
  specificOrgId?: string,
  isAgent: boolean = false
): Promise<Chat | null> {
  try {
    // Use provided orgId, or get the current one consistently
    const organizationId = getCurrentOrganizationId(specificOrgId);
    
    if (!organizationId) {
      console.error('[createChat] No organization ID available');
      return null;
    }
    
    // Get user ID from Supabase
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id || 'anonymous';
    
    // Clear any old chat references first
    localStorage.removeItem('currentChatId');
    localStorage.removeItem('currentSessionId');
    
    // Create a consistent sessionId format
    const timestamp = Date.now();
    const sessionId = `${organizationId}-${userId}-${timestamp}`;
    console.log(`[createChat] Creating new chat with sessionId: ${sessionId} for assistant: ${assistantId}`);
    
    // Create a name if not provided
    const chatName = name || `Chat ${new Date().toLocaleString()}`;
    
    try {
      // Use fetchAPI instead of direct fetch
      const chatData = await fetchAPI('/v1/chats', {
        method: 'POST',
        body: JSON.stringify({
          // For agent-based chats, we only send agentId
          // For assistant-based chats, we send assistantId
          ...(isAgent ? { agentId: assistantId } : { assistantId }),
          sessionId,
          sessionType: 'chat',
          name: chatName,
          userId
        }),
      });
      
      if (!chatData || !chatData.id) {
        console.error('[createChat] Failed to create chat: Invalid response data');
        return null;
      }
      
      console.log(`[createChat] Successfully created chat with ID: ${chatData.id}`);
      
      // Store the sessionId and chatId in localStorage for redundancy
      localStorage.setItem('currentSessionId', sessionId);
      localStorage.setItem('currentChatId', chatData.id);
      
      return chatData;
    } catch (error) {
      console.error('[createChat] Failed to create chat:', error);
      return null;
    }
  } catch (error) {
    console.error('[createChat] Error creating chat:', error);
    
    // Create a fallback chat ID for offline use
    const timestamp = Date.now();
    const fallbackChatId = `chat-${timestamp}-network-error`;
    localStorage.setItem('currentChatId', fallbackChatId);
    
    return null;
  }
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
  role: 'user' | 'assistant',
  specificOrgId?: string
): Promise<ChatMessage | null> {
  // Skip if using fallback chat ID that starts with 'chat-'
  if (!chatId || (chatId.startsWith('chat-') && !chatId.includes('-'))) {
    console.log(`[sendChatMessage] Not saving message to database - using temporary chat ID: ${chatId}`);
    
    // For fallback chats, store messages in localStorage
    try {
      const existingMessages = localStorage.getItem(`chat_messages_${chatId}`);
      let messages = existingMessages ? JSON.parse(existingMessages) : [];
      
      // Add the new message
      const newMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        content,
        role,
        sequenceId: messages.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: 'text'
      };
      
      messages.push(newMessage);
      
      // Store back in localStorage
      localStorage.setItem(`chat_messages_${chatId}`, JSON.stringify(messages));
      console.log(`[sendChatMessage] Saved ${role} message to localStorage for chat ${chatId}`);
      
      return newMessage;
    } catch (e) {
      console.error('[sendChatMessage] Error saving message to localStorage:', e);
      return null;
    }
  }
  
  try {
    // Get existing messages to determine the next sequence ID
    let sequenceId = 0;
    try {
      const messages = await getChatMessages(chatId, specificOrgId);
      if (messages.length > 0) {
        // Find the highest sequence ID and add 1
        sequenceId = Math.max(...messages.map(m => m.sequenceId || 0)) + 1;
      }
    } catch (e) {
      console.error('[sendChatMessage] Error determining sequence ID:', e);
      // Fall back to timestamp-based ID if we can't determine the sequence
      sequenceId = Math.floor(Date.now() / 1000) % 10000; // Convert to seconds and keep only last 4 digits
    }
    
    // Create the message data
    const messageData = {
      content,
      role,
      sequenceId,
      type: 'text'
    };
    
    try {
      // Use fetchAPI instead of direct fetch
      const messageResponse = await fetchAPI(`/v1/chats/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify(messageData),
      });
      
      console.log(`[sendChatMessage] Successfully saved ${role} message to database for chat ${chatId}`);
      return messageResponse;
    } catch (error) {
      // If we get a 400 error, it might be due to a duplicate sequenceId
      if (error instanceof Error && error.message.includes('400') && error.message.includes('sequenceId')) {
        console.log('[sendChatMessage] Retrying with incremented sequence ID');
        
        // Increment the sequence ID and try again
        try {
          const retryData = await fetchAPI(`/v1/chats/${chatId}/messages`, {
            method: 'POST',
            body: JSON.stringify({
              ...messageData,
              sequenceId: sequenceId + 1
            }),
          });
          
          console.log(`[sendChatMessage] Successfully saved ${role} message to database on retry`);
          return retryData;
        } catch (retryError) {
          console.error(`[sendChatMessage] Failed to save message on retry:`, retryError);
          return null;
        }
      }
      
      console.error(`[sendChatMessage] Failed to save message:`, error);
      return null;
    }
  } catch (error) {
    console.error('[sendChatMessage] Error saving message to database:', error);
    return null;
  }
}

/**
 * Update a chat's name
 * @param chatId The ID of the chat
 * @param name The new name for the chat
 * @param specificOrgId Optional: Provide a specific organization ID, otherwise uses active org
 */
export async function updateChatName(
  chatId: string,
  name: string,
  specificOrgId?: string
): Promise<boolean> {
  try {
    // Use fetchAPI instead of direct fetch
    await fetchAPI(`/v1/chats/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    
    console.log(`[updateChatName] Successfully updated chat name for ${chatId}`);
    return true;
  } catch (error) {
    console.error(`[updateChatName] Failed to update chat name:`, error);
    return false;
  }
}

/**
 * Delete a chat
 * @param chatId The ID of the chat
 * @param specificOrgId Optional: Provide a specific organization ID, otherwise uses active org
 */
export async function deleteChat(
  chatId: string,
  specificOrgId?: string
): Promise<boolean> {
  try {
    // Use fetchAPI instead of direct fetch
    await fetchAPI(`/v1/chats/${chatId}`, {
      method: 'DELETE',
    });
    
    console.log(`[deleteChat] Successfully deleted chat ${chatId}`);
    
    // Remove from localStorage if it was the current chat
    if (localStorage.getItem('currentChatId') === chatId) {
      localStorage.removeItem('currentChatId');
      localStorage.removeItem('currentSessionId');
    }
    
    return true;
  } catch (error) {
    console.error(`[deleteChat] Failed to delete chat:`, error);
    return false;
  }
} 