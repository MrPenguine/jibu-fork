import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IoArrowBack, IoClose } from "react-icons/io5";
import { FaRobot } from "react-icons/fa";
import { Button } from "../ui/button";
import { useWorkspace } from '../../../../../apps/frontend/src/utils/workspaceContext';
import { 
  listChats, 
  createChat,
  getChatMessages,
  updateChatName,
  deleteChat,
  Chat as ChatType
} from '../../../../../apps/frontend/src/utils/chatApi';
import { getAssistant, Assistant } from '../../../../../apps/frontend/src/utils/AssistantsApi';
import { sendStreamingAgentRequest, AgentRequest } from '../../../../../apps/frontend/src/utils/AgentApi';
import { Chat, ChatList, Message, saveMessageToDatabase, extractCleanMessageText } from './chat';
import { playTextToSpeech, stopTextToSpeech } from '../../../../../apps/frontend/src/utils/ttsUtils';

// Define types
interface AssistantDetails extends Assistant {}

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
  const [currentChatId, setCurrentChatId] = useState<string | null>(chatId || null);
  const [assistantDetails, setAssistantDetails] = useState<AssistantDetails | null>(null);
  const [userChats, setUserChats] = useState<ChatType[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isChatListView, setIsChatListView] = useState(!chatId); // Show chat list view if no chatId is provided
  const [showBackButton, setShowBackButton] = useState(!!currentChatId);
  const [showingChatHistory, setShowingChatHistory] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); // Track if component has been initialized
  const [ttsEnabled, setTtsEnabled] = useState(true); // Enable TTS by default
  
  // Refs
  const assistantResponseRef = useRef<string>(''); // Store the complete assistant response for TTS
  
  // Workspace context - ensure we have an active workspace before proceeding
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  
  
  // Function to fetch chat messages
  const fetchChatMessages = useCallback(async (chatId: string) => {
    if (!chatId) return;
    
    try {
      setIsLoadingMessages(true);
      const fetchedMessages = await getChatMessages(chatId);
      
      if (fetchedMessages.length > 0) {
        // Convert API messages to our Message format
        const formattedMessages = fetchedMessages.map(msg => ({
          id: msg.id,
          text: msg.content,
          sender: msg.role as 'user' | 'assistant',
          timestamp: new Date(msg.createdAt)
        }));
        
        // Sort messages by timestamp
        formattedMessages.sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return a.timestamp.getTime() - b.timestamp.getTime();
          }
          return 0;
        });
        
        setMessages(formattedMessages);
        setShowBackButton(true);
        setIsChatListView(false);
      }
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);
  
  // Function to fetch user chats
  const fetchUserChats = useCallback(async () => {
    try {
      setIsLoadingChats(true);
      
      // Ensure assistantId is a string
      const assistantIdString = typeof assistantId === 'object' && assistantId !== null
        ? ((assistantId as any).id || String(assistantId)) 
        : String(assistantId);
      
      console.log(`Fetching chats for assistant ID: ${assistantIdString}`);
      
      const response = await listChats(assistantIdString);
      if (response && Array.isArray(response)) {
        // Filter for chats with sessionType 'chat'
        const filteredChats = response.filter(chat => chat.sessionType === 'chat');
        setUserChats(filteredChats);
        console.log(`Found ${filteredChats.length} chats for assistant ${assistantIdString}`);
      }
    } catch (error) {
      console.error('Error fetching user chats:', error);
      // Don't throw errors, just set empty chats
      setUserChats([]);
    } finally {
      setIsLoadingChats(false);
    }
  }, [assistantId]);
  
  // Function to fetch assistant details
  const fetchAssistantDetails = useCallback(async () => {
    try {
      // Ensure assistantId is a string
      const assistantIdString = typeof assistantId === 'object' && assistantId !== null
        ? ((assistantId as any).id || String(assistantId)) 
        : String(assistantId);
      
      console.log(`Fetching details for assistant ID: ${assistantIdString}`);
      
      const assistant = await getAssistant(assistantIdString);
      setAssistantDetails(assistant);
    } catch (error) {
      console.error('Error fetching assistant details:', error);
    }
  }, [assistantId]);
  
  // Initialize component when it mounts
  useEffect(() => {
    if (!isOpen) return;
    
    const initializeComponent = async () => {
      try {
        // Set loading state
        setIsLoadingChats(true);
        setIsLoadingMessages(true);
        
        // Fetch assistant details
        await fetchAssistantDetails();
        
        // Fetch user chats
        await fetchUserChats();
        
        // If we have a chat ID, fetch messages for that chat
        if (currentChatId) {
          await fetchChatMessages(currentChatId);
        }
        
        // Mark as initialized
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing component:', error);
      } finally {
        // Reset loading states
        setIsLoadingChats(false);
        setIsLoadingMessages(false);
      }
    };
    
    initializeComponent();
  }, [isOpen, assistantId, currentChatId, fetchAssistantDetails, fetchUserChats, fetchChatMessages]);
  
  // Function to create a new chat
  const createNewChat = async (messageText: string): Promise<string> => {
    try {
      // Ensure assistantId is a string
      const assistantIdString = typeof assistantId === 'object' && assistantId !== null
        ? ((assistantId as any).id || String(assistantId)) 
        : String(assistantId);
      
      console.log(`Creating new chat for assistant ID: ${assistantIdString}`);
      
      // Create a chat name from the first few words of the message
      const chatName = messageText.split(' ').slice(0, 5).join(' ') + (messageText.length > 30 ? '...' : '');
      
      const response = await createChat(assistantIdString, chatName);
      
      if (response && response.id) {
        return response.id;
      } else {
        throw new Error('Failed to create chat: No ID returned');
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      throw error;
    }
  };
  
  // Function to handle sending a message - this will be passed to the Chat component
  const handleSendMessage = async (messageText: string) => {
    if (!messageText) return;
    
    // Create a new chat if we don't have one yet
    let newChatId = currentChatId;
    if (!newChatId) {
      try {
        newChatId = await createNewChat(messageText);
        setCurrentChatId(newChatId);
        // Save this as the current chat ID
        localStorage.setItem('currentChatId', newChatId);
        console.log(`Created new chat with ID: ${newChatId}`);
        setShowBackButton(true);
        // Ensure we stay in chat view and don't switch to chat list
        setIsChatListView(false);
      } catch (error) {
        console.error('Error creating new chat:', error);
        setMessages(prev => [...prev, { 
          id: 'error-create', 
          text: 'Error creating chat. Please try again.', 
          sender: 'assistant',
          timestamp: new Date()
        }]);
        return;
      }
    }
    
    // Add the user message to the UI immediately
    const userMessageId = `user-${Date.now()}`;
    const userMessage: Message = {
      id: userMessageId,
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Save the user message to the database
    try {
      const isFirstMessage = messages.length === 0;
      const savedToDb = await saveMessageToDatabase(newChatId, messageText, 'user', isFirstMessage);
      
      // Silently continue even if message wasn't saved to database
      // Everything works fine without this
      
      // Add a loading message from the assistant
      const loadingMessageId = `assistant-loading-${Date.now()}`;
      const loadingMessage: Message = {
        id: loadingMessageId,
        text: '...',
        sender: 'assistant',
        isLoading: true,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, loadingMessage]);
      
      // Prepare the agent request
      const assistantIdString = typeof assistantId === 'object' && assistantId !== null
        ? ((assistantId as any).id || String(assistantId)) 
        : String(assistantId);
      
      const request: AgentRequest = {
        input: messageText,
        inputType: 'chat',
        outputType: 'chat',
        sessionId: newChatId,
        config: {
          assistantId: assistantIdString,
          knowledgeBaseId: knowledgeBaseId
        }
      };
      
      // Send the request to the agent API
      let responseText = '';
      
      await sendStreamingAgentRequest(
        request,
        {
          onToken: (token: string, eventData: any) => {
            // Update the loading message with the incoming chunks
            responseText += token;
            
            // Try to parse and extract the clean message text from JSON responses
            let displayText = responseText;
            try {
              // Check if the response is JSON
              if (responseText.trim().startsWith('{') && responseText.includes('"message"')) {
                // Try to parse as JSON
                const jsonResponse = JSON.parse(responseText);
                
                // Extract the message text using the extractCleanMessageText helper
                const extractedText = extractCleanMessageText(jsonResponse);
                if (extractedText && extractedText.length > 0) {
                  displayText = extractedText;
                }
              }
            } catch (e) {
              // If JSON parsing fails, just use the raw text
              console.log('Not valid JSON yet, using raw text');
            }
            
            setMessages(prev => {
              const updatedMessages = [...prev];
              const loadingMessageIndex = updatedMessages.findIndex(m => m.id === loadingMessageId);
              
              if (loadingMessageIndex !== -1) {
                updatedMessages[loadingMessageIndex] = {
                  ...updatedMessages[loadingMessageIndex],
                  text: displayText,
                  isLoading: false // Set to false to show the text while streaming
                };
              }
              
              return updatedMessages;
            });
          },
          onComplete: () => {
            // On completion, update the loading message to a regular message
            setMessages(prev => {
              const updatedMessages = [...prev];
              const loadingMessageIndex = updatedMessages.findIndex(m => m.id === loadingMessageId);
              
              if (loadingMessageIndex !== -1) {
                updatedMessages[loadingMessageIndex] = {
                  ...updatedMessages[loadingMessageIndex],
                  isLoading: false,
                  id: `assistant-${Date.now()}`
                };
              }
              
              return updatedMessages;
            });
            
            // Save the assistant's response to the database
            // Add proper error handling to prevent unhandled promise rejection warnings
            saveMessageToDatabase(newChatId, responseText, 'assistant')
              .catch(error => {
                // Silently handle the error since the UI is already updated
                console.log('Note: Failed to save assistant message to database, but UI is already updated');
              });
              
            // Play the assistant's response using TTS if enabled and voice settings are available
            if (ttsEnabled && assistantDetails?.voice?.voiceId) {
              // Store the complete response for TTS
              assistantResponseRef.current = responseText;
              
              // Extract clean text for TTS
              let ttsText = responseText;
              try {
                if (responseText.trim().startsWith('{') && responseText.includes('"message"')) {
                  const jsonResponse = JSON.parse(responseText);
                  const extractedText = extractCleanMessageText(jsonResponse);
                  if (extractedText && extractedText.length > 0) {
                    ttsText = extractedText;
                  }
                }
              } catch (e) {
                console.log('Not valid JSON, using raw text for TTS');
              }
              
              // Play the text using TTS
              playTextToSpeech(ttsText, {
                voiceId: assistantDetails.voice.voiceId,
                modelId: assistantDetails.voice.model,
                stability: assistantDetails.voice.stability,
                similarityBoost: assistantDetails.voice.similarityBoost,
                speakerBoost: assistantDetails.voice.speakerBoost
              }, true).catch(error => {
                console.error('Error playing TTS:', error);
              });
            }
          },
          onError: (error) => {
            console.error('Error in streaming request:', error);
            // Remove the loading message and add an error message
            setMessages(prev => {
              const filteredMessages = prev.filter(m => !m.isLoading);
              return [...filteredMessages, {
                id: `error-${Date.now()}`,
                text: 'Error processing your message. Please try again.',
                sender: 'assistant',
                timestamp: new Date()
              }];
            });
          }
        }
      );
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Remove the loading message and add an error message
      setMessages(prev => {
        const filteredMessages = prev.filter(m => !m.isLoading);
        return [...filteredMessages, {
          id: `error-${Date.now()}`,
          text: 'Error processing your message. Please try again.',
          sender: 'assistant',
          timestamp: new Date()
        }];
      });
    }
    
    // Update the chat name if it's the first message
    if (messages.length === 0) {
      try {
        await updateChatName(newChatId, messageText.split(' ').slice(0, 5).join(' ') + (messageText.length > 30 ? '...' : ''));
      } catch (error) {
        console.error('Error updating chat name:', error);
      }
    }
    
    // Fetch the updated chat list after sending a message
    fetchUserChats();
  };
  
  // Load initial data
  useEffect(() => {
    // Fetch assistant details when component mounts
    fetchAssistantDetails();
    
    // Fetch user chats
    fetchUserChats();
    
    // If we have a chat ID, fetch messages for that chat
    if (currentChatId) {
      fetchChatMessages(currentChatId);
    }
  }, [fetchAssistantDetails, fetchUserChats, fetchChatMessages, currentChatId]);
  
  // Function to toggle between chat list and current chat
  const toggleChatHistory = () => {
    setShowingChatHistory(!showingChatHistory);
    
    // If we're switching to chat list view, refresh the chat list
    if (!showingChatHistory) {
      fetchUserChats();
    }
  };
  
  // Function to go back to chat list
  const handleBackToList = () => {
    setIsChatListView(true);
    fetchUserChats();
  };
  
  // Function to start a new chat
  const handleNewChat = () => {
    // Clear current chat ID and messages
    setCurrentChatId(null);
    localStorage.removeItem('currentChatId');
    setMessages([]);
    
    // Hide back button since we're starting fresh
    setShowBackButton(false);
    
    // Make sure we're in chat view, not chat list view
    setIsChatListView(false);
    
    // Close chat history if it's open
    setShowingChatHistory(false);
  };
  
  // Function to toggle TTS
  const handleToggleTts = () => {
    setTtsEnabled(!ttsEnabled);
    
    // If turning off TTS, stop any currently playing audio
    if (ttsEnabled) {
      stopTextToSpeech();
    }
  };
  
  // Wait for workspace context to be ready
  if (wsLoading) return null;
  if (!activeWorkspace) return null;
  if (!isOpen) return null;
  
  // If showing chat list view, render the chat list component
  if (isChatListView) {
    return (
      <div className="fixed bottom-5 right-5 w-96 h-[500px] z-50 flex flex-col bg-background rounded-lg shadow-lg">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center">
            <FaRobot className="mr-2" size={16} />
            <h2 className="text-sm font-medium">{assistantName} - Chats</h2>
          </div>
          <div className="flex">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleNewChat}
              className="h-8 px-2 mr-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M12 5v14M5 12h14"></path></svg>
              New
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="h-7 w-7 rounded-full"
            >
              <IoClose size={16} />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatList 
            chats={userChats} 
            isLoading={isLoadingChats} 
            onSelectChat={(selectedChatId: string) => {
              setCurrentChatId(selectedChatId);
              localStorage.setItem('currentChatId', selectedChatId);
              setIsChatListView(false);
              setShowBackButton(true);
              setMessages([]); // Clear messages to force reload
              setIsLoadingMessages(true); // Show loading indicator
              fetchChatMessages(selectedChatId);
            }} 
            onDeleteChat={async (deletedChatId: string) => {
              try {
                const ok = await deleteChat(deletedChatId);
                if (!ok) {
                  throw new Error('Failed to delete chat');
                }
                
                // Refresh the chat list
                fetchUserChats();
              } catch (error) {
                console.error('Error deleting chat:', error);
              }
            }}
            onNewChat={handleNewChat}
            onClose={onClose}
          />
        </div>
      </div>
    );
  }
  
  // Render chat history view instead of main chat if enabled
  if (showingChatHistory) {
    return (
      <div className="fixed bottom-5 right-5 w-96 h-[500px] z-50 flex flex-col">
        <ChatList 
          chats={userChats}
          isLoading={isLoadingChats}
          onSelectChat={(selectedChatId: string) => {
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
          onDeleteChat={async (chatId: string) => {
            try {
              const ok = await deleteChat(chatId);
              if (!ok) {
                throw new Error('Failed to delete chat');
              }
              
              // Refresh the chat list
              fetchUserChats();
            } catch (error) {
              console.error('Error deleting chat:', error);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 w-96 h-[70vh] z-50 bg-white rounded-lg shadow-lg flex flex-col">
      {/* Chat header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleBackToList} 
            className="rounded-full mr-2"
            title="Back to chat list"
          >
            <IoArrowBack size={18} />
          </Button>
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
      
      {/* Use the Chat component */}
      <Chat
        chatId={currentChatId}
        assistantId={assistantId}
        assistantName={assistantName}
        knowledgeBaseId={knowledgeBaseId}
        messages={messages}
        setMessages={setMessages}
        onSendMessage={handleSendMessage}
        onCreateNewChat={handleNewChat}
      />
    </div>
  );
}
