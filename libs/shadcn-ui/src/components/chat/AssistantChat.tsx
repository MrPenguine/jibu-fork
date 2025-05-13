import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IoSend } from 'react-icons/io5';
import { AiOutlinePaperClip, AiOutlineAudio } from 'react-icons/ai';
import { FaRobot } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { sendStreamingAgentRequest, AgentRequest, extractMessageFromResponse } from '../../../../../apps/frontend/src/utils/AgentApi';
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext';
import { 
  listChats, 
  createChat, 
  getChatMessages, 
  sendChatMessage,
  updateChatName,
  Chat as ChatType,
  ChatMessage
} from '../../../../../apps/frontend/src/utils/chatApi';
import { getAssistant, Assistant } from '../../../../../apps/frontend/src/utils/AssistantsApi';
import { ChatList } from './ChatList';

// Define types
interface AssistantDetails extends Assistant {}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp?: Date;
  isLoading?: boolean;
}

// Default initial messages
const initialMessages: Message[] = [];

interface AssistantChatProps {
  assistantId: string;
  assistantName: string;
  knowledgeBaseId?: string;
  chatId?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AssistantChat({ assistantId, assistantName, knowledgeBaseId, chatId, isOpen, onClose }: AssistantChatProps) {
  // State
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(chatId || null);
  const [isDatabaseConnected, setIsDatabaseConnected] = useState(true);
  const [assistantDetails, setAssistantDetails] = useState<AssistantDetails | null>(null);
  const [userChats, setUserChats] = useState<ChatType[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showingChatHistory, setShowingChatHistory] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Get organization context
  const { activeOrganization } = useOrganization();
  
  // Helper to get organization ID for headers
  const getOrgIdHeader = () => {
    if (!activeOrganization?.id) {
      console.error('No active organization ID available');
      return null;
    }
    return activeOrganization.id;
  };

  // Function to extract and clean message text from complex API response
  const extractCleanMessageText = (responseData: any): string => {
    try {
      // If already a string, return it
      if (typeof responseData === 'string') {
        return responseData;
      }
      
      // Try to parse if it's a string that contains JSON
      if (typeof responseData === 'string' && (responseData.startsWith('{') || responseData.startsWith('['))) {
        try {
          responseData = JSON.parse(responseData);
        } catch (e) {
          // If parsing fails, it's probably just a regular string
          return responseData;
        }
      }
      
      // Navigate the complex structure to find the message text
      if (responseData.outputs && Array.isArray(responseData.outputs)) {
        const output = responseData.outputs[0];
        
        // Try to find the message in different locations based on API response structure
        if (output.outputs && Array.isArray(output.outputs)) {
          const innerOutput = output.outputs[0];
          
          // Check results.message.text
          if (innerOutput.results?.message?.text) {
            return innerOutput.results.message.text;
          }
          
          // Check artifacts.message
          if (innerOutput.artifacts?.message) {
            return innerOutput.artifacts.message;
          }
          
          // Check outputs.message.message
          if (innerOutput.outputs?.message?.message) {
            return innerOutput.outputs.message.message;
          }
          
          // Check messages array
          if (innerOutput.messages && Array.isArray(innerOutput.messages) && innerOutput.messages.length > 0) {
            return innerOutput.messages[0].message || '';
          }
        }
      }
      
      // Try other common locations for the message
      if (responseData.output) {
        return responseData.output;
      }
      
      if (responseData.message) {
        return responseData.message;
      }
      
      // If all else fails, stringify the whole object for debugging
      console.warn('Could not extract message text from complex response:', responseData);
      return 'I received your message, but had trouble formatting my response.';
    } catch (error) {
      console.error('Error extracting message text:', error);
      return 'I received your message, but had trouble formatting my response.';
    }
  };
  
  // Define fetchChatMessages as a useCallback before it's used in any useEffect
  const fetchChatMessages = useCallback(async (chatId: string) => {
    if (!chatId) {
      console.error('Attempted to fetch messages with no chatId');
      return;
    }

    try {
      console.log(`Fetching messages for chat: ${chatId}`);
      
      // Clear current messages and show loading state
      setMessages([{
        id: 'loading',
        text: 'Loading messages...',
        sender: 'assistant',
        isLoading: true,
        timestamp: new Date()
      }]);
      
      // Use the getChatMessages utility function from chatApi.ts
      const messages = await getChatMessages(chatId);
      
      if (!messages || messages.length === 0) {
        // If no messages found but we have a valid chatId, show an empty state
        console.log(`No messages found for chat ID ${chatId}`);
        setMessages([{
          id: 'empty',
          text: 'No messages in this chat yet. Type a message to start the conversation.',
          sender: 'assistant',
          timestamp: new Date()
        }]);
        return;
      }
      
      // Log the messages for debugging
      console.log(`Loaded ${messages.length} messages for chat ${chatId}`);
      
      // Remove any potential duplicates by using message ID as key
      const messageMap: Record<string, Message> = {};
      
      // Transform the API messages to our component's format
      messages.forEach((msg: ChatMessage) => {
        if (!msg || !msg.role) {
          console.warn('Received invalid message object:', msg);
          return;
        }
        
        let content = msg.content || '';
        
        // Try to parse and clean if it looks like JSON
        if (msg.role === 'assistant' && typeof content === 'string' && 
            (content.startsWith('{') || content.startsWith('['))) {
          try {
            const parsed = JSON.parse(content);
            content = extractCleanMessageText(parsed);
          } catch (e) {
            // If parsing fails, just use the content as is
            console.warn('Failed to parse message content as JSON:', e);
          }
        }
        
        const message: Message = {
          id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          text: content || '',
          sender: msg.role === 'user' ? 'user' : 'assistant',
          timestamp: new Date(msg.createdAt || Date.now())
        };
        
        // Only add if not already in the map
        if (!messageMap[message.id]) {
          messageMap[message.id] = message;
        }
      });
      
      // Convert the map back to array and sort by timestamp
      const transformedMessages = Object.values(messageMap).sort((a, b) => {
        return a.timestamp && b.timestamp 
          ? a.timestamp.getTime() - b.timestamp.getTime() 
          : 0;
      });
      
      setMessages(transformedMessages);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      // Show error message
      setMessages([{
        id: 'error',
        text: 'Failed to load messages. Please try again.',
        sender: 'assistant',
        timestamp: new Date()
      }]);
    }
  }, []);  // No dependencies needed here

  // Fetch assistant details when component mounts or assistantId changes
  useEffect(() => {
    if (assistantId) {
      const fetchAssistantDetails = async () => {
        try {
          console.log(`Fetching assistant details for: ${assistantId}`);
          
          // Use the getAssistant utility function instead of direct fetch
          const data = await getAssistant(assistantId);
          
          if (data) {
            console.log('Fetched assistant details:', data);
            setAssistantDetails(data);
            
            // If we have a first message from the assistant, update the initial messages
            if (data.firstMessage) {
              console.log('Setting initial message from assistant:', data.firstMessage);
              initialMessages.push({
                id: 'assistant-initial',
                text: data.firstMessage,
                sender: 'assistant',
                timestamp: new Date()
              });
              
              // Only set messages if we don't already have messages (new chat)
              if (messages.length === 0 && !currentChatId && !chatId) {
                setMessages([...initialMessages]);
              }
            }
          } else {
            console.error(`Failed to fetch assistant details for ID: ${assistantId}`);
          }
        } catch (error) {
          console.error('Error fetching assistant details:', error);
        }
      };

      fetchAssistantDetails();
    }
  }, [assistantId]);

  // Fetch all chats for this assistant when component mounts
  useEffect(() => {
    if (assistantId && isOpen) {
      fetchUserChats();
    }
  }, [assistantId, isOpen]);

  // Fetch messages if we have an existing chat ID
  useEffect(() => {
    if (chatId) {
      fetchChatMessages(chatId);
      setCurrentChatId(chatId);
    } else {
      // Check for stored chat in localStorage
      const storedChatId = localStorage.getItem('currentChatId');
      if (storedChatId && assistantId) {
        setCurrentChatId(storedChatId);
        fetchChatMessages(storedChatId);
      } else {
        // Reset to initial messages for a new chat
        if (assistantDetails?.firstMessage) {
          setMessages([{
            id: 'assistant-initial',
            text: assistantDetails.firstMessage,
            sender: 'assistant',
            timestamp: new Date()
          }]);
        } else {
          setMessages(initialMessages);
        }
        setCurrentChatId(null);
      }
    }
  }, [chatId, assistantId, assistantDetails, fetchChatMessages]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Refresh chat list when this component mounts
  useEffect(() => {
    if (isOpen && assistantId) {
      console.log('AssistantChat opened, refreshing chat list');
      // Trigger a refresh by incrementing the refresh trigger
      setRefreshTrigger(prev => prev + 1);
      
      // If we have a current chat ID, load its messages
      if (currentChatId) {
        console.log(`Loading messages for current chat: ${currentChatId}`);
        fetchChatMessages(currentChatId);
      }
    }
  }, [isOpen, assistantId, currentChatId]);

  // Fetch all chats for the current user with this assistant
  const fetchUserChats = async () => {
    try {
      setIsLoadingChats(true);
      
      // Log for debugging
      console.log(`Fetching chats for assistant: ${assistantId}`);
      
      // Use the listChats utility function from chatApi.ts
      const chats = await listChats(assistantId, 'chat');
      setUserChats(chats);
      
      // If we have chats but no current chat selected, use the most recent one
      if (chats.length > 0 && !currentChatId && !chatId) {
        const mostRecentChat = chats[0]; // Assuming chats are sorted by updatedAt desc
        setCurrentChatId(mostRecentChat.id);
        fetchChatMessages(mostRecentChat.id);
      }
    } catch (error) {
      console.error('Error fetching user chats:', error);
      setUserChats([]);
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Function to create a new chat
  const createNewChat = async (messageText: string): Promise<string> => {
    try {
      console.log("Creating new chat for assistant:", assistantId);
      
      // Clear any existing chat data in localStorage first
      localStorage.removeItem('currentChatId');
      localStorage.removeItem('currentSessionId');
      
      // Create a valid chat name
      const chatName = messageText.length > 30 
        ? `${messageText.substring(0, 27)}...` 
        : messageText;
        
      // Use the createChat utility function
      const newChat = await createChat(assistantId, chatName);
      
      if (!newChat || !newChat.id) {
        console.error("Failed to create new chat");
        // Create a fallback chat ID for error handling
        const fallbackChatId = `chat-${Date.now()}-error`;
        // Store the ID for reference
        localStorage.setItem('currentChatId', fallbackChatId);
        return fallbackChatId;
      }
      
      console.log(`Successfully created new chat with ID: ${newChat.id}`);
      
      // Store the new chat ID in state and localStorage
      setCurrentChatId(newChat.id);
      localStorage.setItem('currentChatId', newChat.id);
      
      // Trigger refresh of chat list
      setRefreshTrigger(prev => prev + 1);
      
      return newChat.id;
    } catch (error) {
      console.error("Error creating new chat:", error);
      // Create a fallback chat ID for error handling
      const fallbackChatId = `chat-${Date.now()}-exception`;
      // Store the ID for reference
      localStorage.setItem('currentChatId', fallbackChatId);
      return fallbackChatId;
    }
  };

  const saveMessageToDatabase = async (chatId: string, content: string, role: 'user' | 'assistant', isFirstMessage: boolean = false): Promise<boolean> => {
    // Skip if using fallback chat ID that starts with 'chat-'
    if (!chatId || (chatId.startsWith('chat-') && !chatId.includes('-'))) {
      console.log(`Not saving message to database - using temporary chat ID: ${chatId}`);
      
      // For fallback chats, store messages in localStorage
      try {
        const existingMessages = localStorage.getItem(`chat_messages_${chatId}`);
        let messages = existingMessages ? JSON.parse(existingMessages) : [];
        
        // Add the new message
        messages.push({
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          text: content,
          sender: role,
          timestamp: new Date()
        });
        
        // Store back in localStorage
        localStorage.setItem(`chat_messages_${chatId}`, JSON.stringify(messages));
        console.log(`Saved ${role} message to localStorage for chat ${chatId}`);
      } catch (e) {
        console.error('Error saving message to localStorage:', e);
      }
      
      return false;
    }
    
    try {
      // If this is the first user message, update the chat name to match the message content
      if (isFirstMessage && role === 'user') {
        const chatName = content.length > 50 ? content.substring(0, 47) + '...' : content;
        await updateChatName(chatId, chatName);
      }
      
      // Process the content if it's from the assistant and looks like JSON
      if (role === 'assistant' && typeof content === 'string' && 
          (content.startsWith('{') || content.startsWith('['))) {
        try {
          // Try to parse the JSON to extract the actual message
          const parsed = JSON.parse(content);
          content = extractCleanMessageText(parsed);
        } catch (e) {
          // If parsing fails, use the content as is
          console.warn('Failed to parse assistant message content as JSON:', e);
        }
      }
      
      // Use the sendChatMessage utility function from chatApi.ts
      const result = await sendChatMessage(chatId, content, role);
      
      if (result) {
        console.log(`Successfully saved ${role} message to database for chat ${chatId}`);
        return true;
      } else {
        console.warn(`Failed to save ${role} message to database`);
        return false;
      }
    } catch (error) {
      console.error('Error saving message to database:', error);
      return false;
    }
  };

  // Add a function to handle sending messages
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    // Add user message to the UI immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      text: message,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setMessage(''); // Clear input field
    
    // Create a new chat if we don't have one
    let chatIdToUse = currentChatId;
    let isFirstMessage = false;
    
    if (!chatIdToUse) {
      isFirstMessage = true;
      chatIdToUse = await createNewChat(message);
      console.log(`Created new chat with ID: ${chatIdToUse}`);
      
      // Make sure the currentChatId is set for the rest of the flow
      setCurrentChatId(chatIdToUse);
    }
    
    // Save the message to the database
    await saveMessageToDatabase(chatIdToUse, userMessage.text, 'user', isFirstMessage);
    
    // Show typing indicator
    setIsTyping(true);
    
    try {
      // Prepare the request to the agent
      const request: AgentRequest = {
        input: userMessage.text,
        sessionId: chatIdToUse,
        config: {
          assistantId,
          knowledgeBaseId: knowledgeBaseId || undefined,
          stream: true
        }
      };
      
      // Add a temporary assistant message
      const tempAssistantMessage: Message = {
        id: `assistant-temp-${Date.now()}`,
        text: '',
        sender: 'assistant',
        isLoading: true,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, tempAssistantMessage]);
      
      // Send the request to the agent with streaming
      await sendStreamingAgentRequest(request, {
        onStart: () => {
          console.log('Assistant is responding...');
        },
        onToken: (token, eventData) => {
          // Update the assistant message with each token
          setMessages(prevMessages => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            if (lastMessage && lastMessage.sender === 'assistant' && lastMessage.isLoading) {
              const updatedMessages = [...prevMessages];
              
              // Try to parse token if it looks like JSON
              let cleanToken = token;
              if (typeof token === 'string' && (token.startsWith('{') || token.startsWith('['))) {
                try {
                  const parsed = JSON.parse(token);
                  cleanToken = extractCleanMessageText(parsed);
                } catch (e) {
                  // If parsing fails, just use the token as is
                }
              }
              
              updatedMessages[updatedMessages.length - 1] = {
                ...lastMessage,
                text: cleanToken,
                isLoading: false
              };
              return updatedMessages;
            }
            return prevMessages;
          });
        },
        onComplete: async (fullResponse) => {
          setIsTyping(false);
          
          // Extract clean message from the response
          let cleanResponse = '';
          try {
            if (typeof fullResponse === 'string') {
              // Try to parse JSON if it looks like JSON
              if (fullResponse.startsWith('{') || fullResponse.startsWith('[')) {
                try {
                  const parsed = JSON.parse(fullResponse);
                  cleanResponse = extractCleanMessageText(parsed);
                } catch (e) {
                  cleanResponse = fullResponse;
                }
              } else {
                cleanResponse = fullResponse;
              }
            } else {
              cleanResponse = extractCleanMessageText(fullResponse);
            }
          } catch (error) {
            console.error('Error parsing assistant response:', error);
            cleanResponse = fullResponse.toString();
          }
          
          // Update the UI with the clean response
          setMessages(prevMessages => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            if (lastMessage && lastMessage.sender === 'assistant') {
              const updatedMessages = [...prevMessages];
              updatedMessages[updatedMessages.length - 1] = {
                ...lastMessage,
                text: cleanResponse,
                        isLoading: false 
              };
              return updatedMessages;
            }
            return prevMessages;
          });
          
          // Save the assistant's response to the database
          if (chatIdToUse) {
            await saveMessageToDatabase(chatIdToUse, fullResponse, 'assistant');
            
            // Trigger refresh after sending a message and getting a response
            setRefreshTrigger(prev => prev + 1);
            
            // Re-fetch user chats to update the list
            fetchUserChats();
          }
        },
        onError: (error) => {
          console.error('Error getting response from assistant:', error);
          setIsTyping(false);
          
          // Update the message to show the error
          setMessages(prevMessages => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            if (lastMessage && lastMessage.sender === 'assistant' && lastMessage.isLoading) {
              const updatedMessages = [...prevMessages];
              updatedMessages[updatedMessages.length - 1] = {
                ...lastMessage,
                text: "Sorry, I encountered an error while processing your request.",
                isLoading: false
              };
              return updatedMessages;
            }
            return prevMessages;
          });
        }
      });
    } catch (error) {
      console.error('Error in chat flow:', error);
      setIsTyping(false);
    }
  };

  // Function to show chat history
  const toggleChatHistory = () => {
    setShowingChatHistory(!showingChatHistory);
  };

  // Function to start a new chat
  const handleNewChat = async () => {
    console.log("Starting new chat from AssistantChat button");
    
    // Clear current chat ID
    setCurrentChatId(null);
    
    // Clear localStorage data
    localStorage.removeItem('currentChatId');
    localStorage.removeItem('currentSessionId');
    
    // Reset to initial welcome message
    if (assistantDetails?.firstMessage) {
      setMessages([{
        id: 'assistant-initial',
        text: assistantDetails.firstMessage,
        sender: 'assistant',
        timestamp: new Date()
      }]);
    } else {
      setMessages(initialMessages);
    }
    
    // If chat history is showing, close it
    if (showingChatHistory) {
      setShowingChatHistory(false);
    }
    
    // Create a new empty chat to ensure consistent behavior
    try {
      const defaultName = "New conversation";
      const chatId = await createNewChat(defaultName);
      console.log(`Created new empty chat with ID: ${chatId}`);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error creating new empty chat:", error);
    }
  };

  if (!isOpen) return null;

  // Render chat history view instead of main chat if enabled
  if (showingChatHistory) {
    return (
      <div className="fixed bottom-5 right-5 w-96 h-[70vh] z-50 flex flex-col">
        <ChatList 
          assistantId={assistantId} 
          onSelectChat={(selectedChatId) => {
            console.log(`Selected chat from history: ${selectedChatId}`);
            // Clear existing messages before loading new ones
            setMessages([]);
            // Update current chat ID
            setCurrentChatId(selectedChatId);
            // Fetch messages for this chat
            fetchChatMessages(selectedChatId);
            // Close chat history view
            setShowingChatHistory(false);
          }} 
          onNewChat={() => {
            handleNewChat();
          }}
          onClose={() => setShowingChatHistory(false)}
          refreshTrigger={refreshTrigger}
        />
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 w-96 h-[70vh] z-50 bg-white rounded-lg shadow-lg flex flex-col">
      {/* Chat header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center">
          <FaRobot className="text-primary mr-2" size={18} />
          <h3 className="font-medium">{assistantName}</h3>
        </div>
        <div className="flex">
          {currentChatId && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleChatHistory} 
              className="rounded-full mr-1"
              title="Chat history"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            </Button>
          )}
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
            <IoClose size={18} />
          </Button>
        </div>
      </div>
      
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
              className={`max-w-[80%] rounded-lg p-3 ${
                  msg.sender === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
                }`}
              >
                {msg.isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-current animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-current animate-bounce delay-100" />
                  <div className="w-2 h-2 rounded-full bg-current animate-bounce delay-200" />
                  </div>
                ) : (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              )}
              {msg.timestamp && (
                <div className={`text-xs mt-1 ${
                  msg.sender === 'user' 
                    ? 'text-primary-foreground/70' 
                    : 'text-muted-foreground'
                }`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <form onSubmit={handleSendMessage} className="p-4 border-t flex items-center space-x-2">
        <Button 
          type="button" 
          variant="ghost" 
          size="icon"
          className="rounded-full flex-shrink-0"
        >
          <AiOutlinePaperClip size={18} />
        </Button>
        <Button 
          type="button" 
          variant="ghost" 
          size="icon"
          className="rounded-full flex-shrink-0"
        >
          <AiOutlineAudio size={18} />
        </Button>
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-muted rounded-full px-4 py-2 focus:outline-none"
          disabled={isTyping}
        />
        <Button 
          type="submit" 
          variant="ghost" 
          size="icon" 
          className="rounded-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!message.trim() || isTyping}
        >
          <IoSend size={18} />
        </Button>
      </form>
    </div>
  );
}