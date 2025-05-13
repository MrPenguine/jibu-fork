import React, { useState, useEffect } from 'react';
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { IoMdAdd, IoMdArrowRoundBack } from "react-icons/io";
import { FaRegClock } from "react-icons/fa";
import { formatDistanceToNow } from 'date-fns';
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext';
import { listChats, getChatMessages, ChatMessage } from '../../../../../apps/frontend/src/utils/chatApi';

interface Chat {
  id: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  assistantId: string;
}

interface ChatListProps {
  assistantId: string;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onClose: () => void;
  refreshTrigger?: number;
}

// Helper function to extract message text from complex JSON structure
const extractMessageText = (content: string): string => {
  try {
    if (!content || typeof content !== 'string') {
      return 'No message content';
    }
    
    if (!content.startsWith('{') && !content.startsWith('[')) {
      return content;
    }
    
    const parsed = JSON.parse(content);
    
    // For known API response patterns
    if (parsed.outputs && Array.isArray(parsed.outputs)) {
      const output = parsed.outputs[0];
      
      if (output.outputs && Array.isArray(output.outputs)) {
        const innerOutput = output.outputs[0];
        
        // Check various possible locations for the message text
        if (innerOutput.results?.message?.text) {
          return innerOutput.results.message.text;
        }
        
        if (innerOutput.artifacts?.message) {
          return innerOutput.artifacts.message;
        }
        
        if (innerOutput.outputs?.message?.message) {
          return innerOutput.outputs.message.message;
        }
        
        if (innerOutput.messages && Array.isArray(innerOutput.messages) && innerOutput.messages.length > 0) {
          return innerOutput.messages[0].message || '';
        }
      }
    }
    
    // Try other common locations
    if (parsed.output) {
      return parsed.output;
    }
    
    if (parsed.message) {
      return parsed.message;
    }
    
    if (parsed.text) {
      return parsed.text;
    }
    
    // If we can't find the message in any expected location, return a generic message
    return 'Message content unavailable';
  } catch (e) {
    console.warn('Failed to parse message content as JSON:', e);
    return content;
  }
};

export function ChatList({ assistantId, onSelectChat, onNewChat, onClose, refreshTrigger = 0 }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { activeOrganization } = useOrganization();

  // Function to get the last message for each chat
  const fetchLastMessages = async (fetchedChats: Chat[]) => {
    if (!fetchedChats.length) return fetchedChats;
    
    console.log(`Fetching last messages for ${fetchedChats.length} chats`);
    
    try {
      const chatsWithLastMessage = await Promise.all(
        fetchedChats.map(async (chat) => {
          try {
            console.log(`Fetching messages for chat ${chat.id}`);
            const messages = await getChatMessages(chat.id);
            
            let lastMessage = '';
            if (messages.length > 0) {
              // Start from the end to find the first non-empty message
              for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i];
                if (!msg || !msg.content) continue;
                
                let content = msg.content;
                
                // Handle JSON-formatted content from assistant
                if (msg.role === 'assistant' && typeof content === 'string' && 
                    (content.startsWith('{') || content.startsWith('['))) {
                  content = extractMessageText(content);
                }
                
                if (content && typeof content === 'string' && content.trim()) {
                  // Limit the message preview length
                  lastMessage = content.length > 60 ? content.substring(0, 57) + '...' : content;
                  break;
                }
              }
            }
            
            return {
              ...chat,
              lastMessage
            };
          } catch (error) {
            console.error(`Error fetching messages for chat ${chat.id}:`, error);
            return chat;
          }
        })
      );
      
      return chatsWithLastMessage;
    } catch (error) {
      console.error('Error processing chats with last messages:', error);
      return fetchedChats;
    }
  };

  // Fetch chats when the component mounts or when dependencies change
  useEffect(() => {
    let isMounted = true;
    
    async function fetchChats() {
      try {
        setLoading(true);
        console.log(`Fetching chats for assistant: ${assistantId}`);
        
        if (!assistantId) {
          console.error('No assistantId provided to ChatList');
          setError('No assistant selected');
          setChats([]);
          return;
        }
        
        if (!activeOrganization) {
          console.error('No active organization');
          setError('No active organization');
          return;
        }
        
        // Fetch chats for this specific assistant
        const fetchedChats = await listChats(assistantId, 'chat');
        
        // Check if the component is still mounted before updating state
        if (!isMounted) return;
        
        console.log(`Received ${fetchedChats.length} chats from API for assistant ${assistantId}`);
        
        if (fetchedChats.length === 0) {
          console.log('No chats found for this assistant - This is normal for new assistants');
          setChats([]);
          setError(null);
          setLoading(false);
        } else {
          // Get last message for each chat
          const chatsWithMessages = await fetchLastMessages(fetchedChats);
          
          // Check if the component is still mounted before updating state
          if (!isMounted) return;
          
          // Sort by most recently updated first
          const sortedChats = chatsWithMessages.sort((a, b) => {
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
          
          setChats(sortedChats);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!isMounted) return;
        
        console.error('Error fetching chats:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    }
    
    // Fetch immediately
    fetchChats();
    
    // Set up polling for updates, but less frequently to avoid conflicts
    const refreshInterval = setInterval(fetchChats, 15000);
    
    // Clean up interval on unmount
    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
    
  }, [assistantId, activeOrganization, refreshTrigger]);

  // Handle selecting a chat
  const handleSelectChat = (chatId: string) => {
    console.log(`Selected chat: ${chatId}`);
    onSelectChat(chatId);
  };

  // Handle starting a new chat
  const handleNewChat = () => {
    console.log("Starting new chat from ChatList");
    
    // First clear any existing chat data
    localStorage.removeItem('currentChatId');
    localStorage.removeItem('currentSessionId');
    
    // Call the onNewChat handler provided by parent
    onNewChat();
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          <h3 className="font-medium ml-2">Chat History</h3>
        </div>
        <div className="flex">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleNewChat}
            className="rounded-full mr-1"
            title="New chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"></path></svg>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="rounded-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
          </Button>
        </div>
      </div>
      
      {/* Chat List */}
      <ScrollArea className="flex-1 p-2">
        {loading && chats.length === 0 ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center p-4 text-red-500">
            <p>{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={onNewChat}
            >
              Start New Chat
            </Button>
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <p className="mb-2">No previous conversations found</p>
            <Button 
              size="sm" 
              onClick={onNewChat}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <IoMdAdd size={18} className="mr-1" />
              Start First Chat
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => (
              <Card 
                key={chat.id}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleSelectChat(chat.id)}
              >
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium truncate">
                        {chat.name || 'Conversation'}
                      </h3>
                      {chat.lastMessage && (
                        <p className="text-sm text-gray-500 truncate mt-1">
                          {chat.lastMessage}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center whitespace-nowrap ml-2">
                      <FaRegClock className="mr-1" size={12} />
                      {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
} 