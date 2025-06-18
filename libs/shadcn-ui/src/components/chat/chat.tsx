import React, { useState, useRef, useEffect } from 'react';
import { IoSend } from 'react-icons/io5';
import { AiOutlinePaperClip, AiOutlineAudio } from 'react-icons/ai';
import { Button } from "../ui/button";
import { sendStreamingAgentRequest, AgentRequest } from '../../../../../apps/frontend/src/utils/AgentApi';
import {
  getChatMessages,
  updateChatName,
  ChatMessage
} from '../../../../../apps/frontend/src/utils/chatApi';

// Define types for the chat component
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp?: Date;
  isLoading?: boolean;
}

interface ChatProps {
  chatId: string | null;
  assistantId: string;
  assistantName: string;
  knowledgeBaseId?: string;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onSendMessage: (message: string) => Promise<void>;
  onCreateNewChat?: () => void;
}

// Helper function to extract clean message text from complex API response
export const extractCleanMessageText = (responseData: any): string => {
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
      }
      
      // Check if output has a message property directly
      if (output.message) {
        return output.message;
      }
      
      // Check if output has a text property directly
      if (output.text) {
        return output.text;
      }
    }
    
    // If we couldn't find the message in the expected structure, try to stringify the object
    return JSON.stringify(responseData);
  } catch (error) {
    console.error('Error extracting message text:', error);
    return 'Error processing response';
  }
};

// Function to save a message to the database
export const saveMessageToDatabase = async (
  chatId: string, 
  content: string, 
  role: 'user' | 'assistant', 
  isFirstMessage: boolean = false
): Promise<boolean> => {
  try {
    // Check if this message is already in the database to prevent duplicates
    const existingMessages = await getChatMessages(chatId);
    const isDuplicate = existingMessages.some(msg => 
      msg.content === content && 
      msg.role === role &&
      // Check if the message was created in the last 5 seconds
      (new Date().getTime() - new Date(msg.createdAt).getTime()) < 5000
    );
    
    if (isDuplicate) {
      console.log(`Skipping duplicate ${role} message`);
      return true; // Pretend we saved it successfully
    }
    
    // Get organization ID for headers
    const orgId = localStorage.getItem('currentOrganizationId');
    
    // Prepare the message data
    const messageData = {
      content,
      role
    };
    
    // Send the message to the API
    // Fix the API endpoint path - remove the /api prefix as it's not needed
    const response = await fetch(`/v1/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(orgId ? { 'x-organization-id': orgId } : {})
      },
      body: JSON.stringify(messageData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save message: ${response.status}`);
    }
    
    // If this is the first message, update the chat name
    if (isFirstMessage && role === 'user') {
      // Use the first few words of the message as the chat name
      const chatName = content.split(' ').slice(0, 5).join(' ') + (content.length > 30 ? '...' : '');
      await updateChatName(chatId, chatName);
    }
    
    return true;
  } catch (error) {
    // Silently ignore errors since the chat functionality works without saving to the database
    return false;
  }
};

// Chat component for handling messages and UI
export function Chat({
  chatId,
  assistantId,
  assistantName,
  knowledgeBaseId,
  messages,
  setMessages,
  onSendMessage,
  onCreateNewChat
}: ChatProps) {
  // State
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Function to scroll to the bottom of the chat
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Focus input field when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  // Handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const messageText = message.trim();
    if (!messageText || isTyping) return;
    
    // Clear the input field
    setMessage('');
    
    // Call the parent component's onSendMessage function
    await onSendMessage(messageText);
  };
  
  return (
    <div className="flex flex-col h-full relative">
      {/* Chat messages */}
      <div className="absolute top-0 left-0 right-0 bottom-[70px] overflow-y-auto p-4 space-y-4">
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
                <p className="whitespace-pre-wrap">{msg.text === '...' ? '' : msg.text}</p>
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
      
      {/* Input area - fixed at the bottom */}
      <form onSubmit={handleSendMessage} className="absolute bottom-0 left-0 right-0 p-4 border-t flex items-center space-x-2 bg-background">
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

// Export the ChatList component from this file as well
export { ChatList } from './ChatList';
