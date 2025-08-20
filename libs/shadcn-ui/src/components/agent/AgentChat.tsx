"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaRobot } from 'react-icons/fa';
import { IoArrowBack, IoClose } from 'react-icons/io5';
import { MdAdd, MdVolumeUp, MdVolumeOff } from 'react-icons/md';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Card } from '../ui/card';
import { v4 as uuidv4 } from 'uuid';

// API clients
import * as chatApi from '../../../../../apps/frontend/src/utils/chatApi';
import * as agentApi from '../../../../../apps/frontend/src/utils/AgentApi';
import { getAgentWebhookUrl, sendStreamingWebhookMessage } from '../../../../../apps/frontend/src/utils/agentWebhookUtils';

// TTS utilities
import { playTextToSpeech, stopTextToSpeech, isTtsPlaying } from '../../../../../apps/frontend/src/utils/ttsUtils';

// Organization context
import { useWorkspace } from '../../../../../apps/frontend/src/utils/workspaceContext';

// --- Interfaces ---
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isLoading?: boolean;
}

interface ChatSession {
  id: string;
  name: string;
  createdAt: Date;
  assistantId: string;
}

interface AgentDetails {
  id: string;
  name: string;
  description?: string;
  isPublished?: boolean;
}

interface AgentChatProps {
  agentId: string;
  agentName?: string;
  knowledgeBaseId?: string;
  checkPublishStatus?: boolean;
  isOpen: boolean;
  onClose: () => void;
  chatId?: string | null;
  children?: React.ReactNode;
}

// --- Child Component Interfaces ---
interface ChatListProps {
  chats: ChatSession[];
  isLoading: boolean;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
}

interface MessageCardProps {
  message: Message;
}

// --- Child Components ---

const TypingIndicator: React.FC = () => (
  <div className="flex items-center space-x-2 p-2">
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></div>
    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
  </div>
);

const MessageCard: React.FC<MessageCardProps> = ({ message }) => (
  <div className={`flex my-2 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
    <Card className={`p-3 max-w-xs lg:max-w-md rounded-2xl ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-gray-200'}`}>
      <p className="text-sm whitespace-pre-wrap">{message.text}</p>
      {message.isLoading && <TypingIndicator />}
    </Card>
  </div>
);

const ChatList: React.FC<ChatListProps> = ({ chats, isLoading, onSelectChat, onNewChat, onDeleteChat }) => {
  if (isLoading) {
    return <div className="flex-grow flex items-center justify-center"><p>Loading chats...</p></div>;
  }

  return (
    <div className="flex flex-col h-full">
        <div className="p-2">
            <Button onClick={onNewChat} className="w-full">
                <MdAdd className="mr-2"/>
                New Chat
            </Button>
        </div>
        <ScrollArea className="flex-grow">
        <div className="p-2">
            {chats.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No chat history.</p>
            ) : (
            chats.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(chat => (
                <Card key={chat.id} className="p-2 mb-2 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors">
                <div onClick={() => onSelectChat(chat.id)} className="flex-grow mr-2">
                    <p className="font-medium truncate">{chat.name || 'Untitled Chat'}</p>
                    <p className="text-xs text-gray-500">{new Date(chat.createdAt).toLocaleDateString()}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); onDeleteChat(chat.id)}} className="text-gray-400 hover:text-red-500 rounded-full w-8 h-8">
                    <IoClose size={16}/>
                </Button>
                </Card>
            ))
            )}
        </div>
        </ScrollArea>
    </div>
  );
};

// --- Main AgentChat Component ---
export default function AgentChat({
  agentId,
  agentName: initialAgentName,
  knowledgeBaseId,
  checkPublishStatus = true,
  isOpen,
  onClose,
  chatId: initialChatId,
  children
}: AgentChatProps) {
  // Organization context
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  // State
  const [userInput, setUserInput] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [userChats, setUserChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(initialChatId || null);
  const [agentName, setAgentName] = useState<string>(initialAgentName || '');
  const [isLoadingChats, setIsLoadingChats] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [agentDetails, setAgentDetails] = useState<AgentDetails | null>(null);
  const [isAgentPublished, setIsAgentPublished] = useState<boolean>(true);
  const [showingChatList, setShowingChatList] = useState<boolean>(initialChatId === null);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);

  // --- Utility Functions ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // --- Data Fetching and API Calls ---
  const fetchAgentDetails = useCallback(async () => {
    if (!checkPublishStatus) {
      setIsInitialized(true);
      return;
    }
    try {
      setIsInitialized(false);
      const agent = await agentApi.agentApiClient.getAgent(agentId, activeWorkspaceId);
      setAgentDetails(agent);
      
      // Set agent name if not provided in props
      if (!initialAgentName) {
        setAgentName(agent.name);
      }
      
      // Check if agent is published if required
      if (checkPublishStatus) {
        setIsAgentPublished(!!agent.isPublished);
      }
      
      // Check if agent has an associated assistant
      if (agent.assistantId) {
        setAssistantId(agent.assistantId);
      }
      
      // Fetch the webhook URL for this agent
      const webhookUrlResult = await getAgentWebhookUrl(agentId, activeWorkspaceId);
      if (webhookUrlResult) {
        setWebhookUrl(webhookUrlResult);
        console.log('Agent webhook URL found:', webhookUrlResult);
      } else {
        console.warn('No webhook URL found for agent', agentId);
      }
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Error fetching agent details:', error);
      toast({ title: 'Error', description: 'Failed to load agent details', variant: 'destructive' });
    }
  }, [isOpen, agentId, activeWorkspaceId, initialAgentName, checkPublishStatus, toast]);

  const fetchUserChats = useCallback(async () => {
    if (!agentId) return;
    try {
      setIsLoadingChats(true);
      const chats = await chatApi.listChats(agentId, 'agent', 'chat', activeWorkspaceId);
      // Convert Chat[] to ChatSession[] by ensuring all properties match the expected types
      const chatSessions: ChatSession[] = chats.map((chat: chatApi.Chat) => ({
        id: chat.id,
        name: chat.name || 'Untitled Chat', // Ensure name is always a string
        createdAt: new Date(chat.createdAt),
        assistantId: chat.assistantId
      }));
      setUserChats(chatSessions);
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast({ title: 'Error', description: 'Could not fetch chat history.', variant: 'destructive' });
    } finally {
      setIsLoadingChats(false);
    }
  }, [agentId, activeWorkspaceId, toast]);

  const fetchChatMessages = useCallback(async (chatId: string) => {
    try {
      setIsLoadingMessages(true);
      setShowingChatList(false);
      const apiMessages = await chatApi.getChatMessages(chatId, activeWorkspaceId);
      const formattedMessages = (apiMessages || []).map((msg: any) => ({
        id: msg.id,
        text: msg.content,
        sender: msg.role as 'user' | 'assistant',
        timestamp: new Date(msg.createdAt),
      })).sort((a: Message, b: Message) => a.timestamp.getTime() - b.timestamp.getTime());
      setMessages(formattedMessages);
      setCurrentChatId(chatId);
    } catch (error) {
      console.error(`Error fetching messages for chat ${chatId}:`, error);
      toast({ title: 'Error', description: 'Could not load chat messages.', variant: 'destructive' });
    } finally {
      setIsLoadingMessages(false);
    }
  }, [activeWorkspaceId, toast]);

  const handleNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setShowingChatList(false);
    setIsTyping(false);
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await chatApi.deleteChat(chatId, activeWorkspaceId);
      toast({ title: 'Success', description: 'Chat deleted successfully.' });
      if (currentChatId === chatId) {
        setShowingChatList(true);
        setCurrentChatId(null);
        setMessages([]);
      }
      fetchUserChats();
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({ title: 'Error', description: 'Could not delete chat.', variant: 'destructive' });
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || loading) return;

    const userMessage: Message = {
      id: uuidv4(),
      text: userInput,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = userInput;
    setUserInput('');
    setLoading(true);
    setIsTyping(true);
    agentResponseRef.current = '';

    let chatId = currentChatId;
    const assistantMessageId = uuidv4();

    try {
      if (!chatId) {
        const newChat = await chatApi.createChat(agentId, currentInput.substring(0, 30), activeWorkspaceId, true);
        if (!newChat) {
          throw new Error('Failed to create new chat');
        }
        chatId = newChat.id;
        setCurrentChatId(chatId);
        fetchUserChats();
      }

      const assistantMessage: Message = {
        id: assistantMessageId,
        text: '',
        sender: 'assistant',
        timestamp: new Date(),
        isLoading: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      
      // Get agent metadata
      const agentMetadata = agentDetails?.metadata as Record<string, any> || {};
      
      // Check if we have a webhook URL and should use N8N webhook streaming
      if (webhookUrl) {
        console.log('Using N8N webhook URL for streaming:', webhookUrl);
        
        // Use the streaming webhook endpoint
        await sendStreamingWebhookMessage(
          webhookUrl,
          currentInput,
          chatId,
          {
            onStart: () => {
              console.log('Webhook streaming started');
            },
            onToken: (token) => {
              agentResponseRef.current += token;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId ? { ...msg, text: agentResponseRef.current, isLoading: true } : msg
                )
              );
            },
            onError: (error) => {
              console.error('Error in webhook streaming:', error);
              toast({ title: 'Error', description: `Webhook streaming error: ${error.message}`, variant: 'destructive' });
            },
            onComplete: () => {
              console.log('Webhook streaming completed');
            }
          },
          {
            // Optional parameters
            systemPrompt: agentMetadata?.systemPrompt,
            contextLength: 10 // Use larger context length for better conversation flow
          }
        );
      } else {
        // Fallback to regular agent API if no webhook URL is available
        console.log('No webhook URL available, falling back to regular agent API');
        
        // Initialize the request
        const request: agentApi.AgentRequest = {
          input: currentInput,
          sessionId: chatId,
          config: {
            // Default value that will be overridden based on agent type
            assistantId: '',
            knowledgeBaseId: knowledgeBaseId || undefined,
            stream: true
          }
        };
        
        // Check if agent might be a workflow agent based on its metadata
        const isWorkflowAgent = agentMetadata?.isWorkflow || agentMetadata?.workflow;
        
        if (isWorkflowAgent) {
          // For workflow agents, don't send assistantId at all - backend will extract it from workflow
          console.log('Sending workflow agent request - backend will extract assistantId from workflow nodes');
          // Required for backend to identify this as a workflow agent
          (request.config as any).workflowAgent = true;
          // Not setting assistantId for workflow agents - backend will handle it
        } else if (assistantId) {
          // For direct assistant agents, use the assistantId from the agent definition
          console.log(`Using assistant ID for streaming request: ${assistantId}`);
          request.config.assistantId = assistantId;
        } else {
          // Only use agentId as assistantId for non-workflow agents as a last resort
          console.warn('Assistant ID not found in agent definition, using agent ID as fallback. This might cause errors!');
          request.config.assistantId = agentId;
        }
        
        console.log(`Final request config:`, request.config);
        
        await agentApi.sendStreamingAgentRequest(request, {
          headers: { 'X-Organization-ID': activeWorkspaceId },
          onToken: (token) => {
            agentResponseRef.current += token;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId ? { ...msg, text: agentResponseRef.current, isLoading: true } : msg
              )
            );
          },
          onError: (error) => {
            console.error('Error in streaming response:', error);
          },
          onComplete: () => {
            // Handle completion if needed
          }
        });
        
        // Handle TTS for the response if enabled
        if (ttsEnabled && agentResponseRef.current) {
          // Pass required parameters to TTS function
          playTextToSpeech(agentResponseRef.current, {
            voiceId: 'en-US'
          });
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Error', description: 'Failed to send message.', variant: 'destructive' });
      setMessages((prev) => prev.filter((msg) => msg.id !== userMessage.id && msg.id !== assistantMessageId));
    } finally {
      setLoading(false);
      setIsTyping(false);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, isLoading: false } : msg))
      );
    }
  };

  // --- Effects ---
  useEffect(() => {
    fetchAgentDetails();
  }, [fetchAgentDetails]);

  useEffect(() => {
    if (isInitialized && isAgentPublished) {
      fetchUserChats();
      
      // If initialChatId is provided, fetch its messages
      if (initialChatId) {
        fetchChatMessages(initialChatId);
      }
    }
  }, [isInitialized, isAgentPublished, fetchUserChats, initialChatId, fetchChatMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Polling mechanism to fetch new messages periodically
  useEffect(() => {
    // Don't poll if no current chat is selected or we're loading
    if (!currentChatId || loading || isLoadingMessages) return;
    
    console.log(`Setting up polling for chat messages: ${currentChatId}`);
    
    // Poll for new messages every 2 seconds
    const pollingInterval = setInterval(async () => {
      try {
        if (!currentChatId) return;
        
        const apiMessages = await chatApi.getChatMessages(currentChatId, activeWorkspaceId);
        const latestMessages = (apiMessages || []).map((msg: any) => ({
          id: msg.id,
          text: msg.content,
          sender: msg.role as 'user' | 'assistant',
          timestamp: new Date(msg.createdAt),
        })).sort((a: Message, b: Message) => a.timestamp.getTime() - b.timestamp.getTime());
        
        // Compare with current messages to see if we have updates
        if (JSON.stringify(latestMessages) !== JSON.stringify(messages)) {
          console.log('Detected new or changed messages, updating message list');
          setMessages(latestMessages);
        }
      } catch (error) {
        console.error('Error polling for new messages:', error);
        // Don't show toast for polling errors to avoid spamming the user
      }
    }, 2000); // Poll every 2 seconds
    
    return () => {
      clearInterval(pollingInterval);
    };
  }, [currentChatId, activeWorkspaceId, loading, isLoadingMessages, messages]);

  useEffect(() => {
    return () => {
      if (isTtsPlaying()) {
        stopTextToSpeech();
      }
    };
  }, []);

  if (!isOpen) return null;

  // --- Render Logic ---
  const renderContent = () => {
    if (!isInitialized) {
      return <div className="flex-grow flex items-center justify-center"><p>Initializing agent...</p></div>;
    }

    if (checkPublishStatus && !isAgentPublished) {
      return (
        <div className="flex-grow p-4 flex flex-col items-center justify-center text-center">
          <FaRobot size={40} className="text-gray-300 mb-4" />
          <h3 className="text-lg font-medium mb-2">Agent Not Published</h3>
          <p className="text-gray-500">Please publish this agent before you can chat with it.</p>
        </div>
      );
    }

    if (showingChatList) {
      return (
        <ChatList
          chats={userChats}
          isLoading={isLoadingChats}
          onSelectChat={fetchChatMessages}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
        />
      );
    }

    return (
      <>
        <ScrollArea className="flex-grow p-4 bg-gray-50/50">
          {messages.map((msg) => (
            <MessageCard key={msg.id} message={msg} />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </ScrollArea>
        <div className="p-4 border-t">
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
            <div className="flex items-center">
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Type your message..."
                disabled={loading}
                className="flex-grow"
              />
              <Button type="submit" disabled={loading || !userInput.trim()} className="ml-2">
                Send
              </Button>
            </div>
          </form>
        </div>
      </>
    );
  };

  return (
    <div className="fixed bottom-5 right-5 w-96 h-[70vh] z-50 bg-white rounded-lg shadow-2xl flex flex-col border">
      <header className="flex items-center justify-between p-3 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center">
          {!showingChatList && initialChatId === null && (
            <Button variant="ghost" size="icon" onClick={() => setShowingChatList(true)} className="rounded-full mr-2">
              <IoArrowBack size={18} />
            </Button>
          )}
          <FaRobot className="text-primary mr-2" size={18} />
          <h3 className="font-medium">{agentName}</h3>
        </div>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => setTtsEnabled(!ttsEnabled)} className="rounded-full" title={ttsEnabled ? 'Disable TTS' : 'Enable TTS'}>
            {ttsEnabled ? <MdVolumeUp size={18} /> : <MdVolumeOff size={18} />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <IoClose size={18} />
          </Button>
        </div>
      </header>
      {renderContent()}
      {children && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
