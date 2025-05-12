import React, { useState, useRef, useEffect } from 'react';
import { IoSend } from 'react-icons/io5';
import { AiOutlinePaperClip, AiOutlineAudio } from 'react-icons/ai';
import { FaRobot } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { Button } from "@libs/shadcn-ui/components/ui/button";

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isLoading?: boolean;
}

const initialMessages: Message[] = [
  { id: '1', text: 'Hello! I\'m your knowledge assistant. How can I help you today?', sender: 'assistant', timestamp: new Date() },
];

interface AssistantChatProps {
  assistantId: string;
  assistantName: string;
  knowledgeBaseId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AssistantChat({ assistantId, assistantName, knowledgeBaseId, isOpen, onClose }: AssistantChatProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;
    
    // Add user message to the chat
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };
    
    // Add temporary assistant message with loading state
    const tempAssistantMessageId = (Date.now() + 1).toString();
    const tempAssistantMessage: Message = {
      id: tempAssistantMessageId,
      text: '',
      sender: 'assistant',
      timestamp: new Date(),
      isLoading: true
    };
    
    setMessages(prev => [...prev, userMessage, tempAssistantMessage]);
    setMessage('');
    
    try {
      // Scroll to bottom after adding new messages
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      
      // Create request for streaming response
      const request = {
        input: messageText,
        inputType: 'chat',
        outputType: 'chat',
        sessionId: 'anonymous',
        config: {
          assistantId: assistantId,
          clientId: 'anonymous',
          knowledgeBaseId: knowledgeBaseId,
          stream: true
        }
      };
      
      // Use fetch with streaming instead of EventSource
      const response = await fetch('/api/v1/agent/stream?request=' + encodeURIComponent(JSON.stringify(request)));
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
      // Check if we have a streaming response
      if (!response.body) {
        throw new Error('No response body from server');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode the chunk and split by double newlines (SSE format)
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.substring(6));
              
              // Handle error responses
              if (eventData.error) {
                throw new Error(eventData.message || 'Unknown error');
              }
              
              // Extract the output text from the Langflow response
              let outputText = '';
              
              // Check if we're dealing with a raw Langflow response
              if (typeof eventData.output === 'string' && eventData.output.includes('session_id') && eventData.output.includes('outputs')) {
                console.log('Detected Langflow response format, attempting to parse:', eventData.output.substring(0, 100) + '...');
                try {
                  // Parse the nested JSON response
                  const langflowData = JSON.parse(eventData.output);
                  console.log('Successfully parsed Langflow data');
                  
                  if (langflowData.outputs && Array.isArray(langflowData.outputs) && langflowData.outputs.length > 0) {
                    // Navigate through the nested structure
                    const outputsData = langflowData.outputs[0].outputs;
                    
                    if (Array.isArray(outputsData) && outputsData.length > 0) {
                      // Try to find the message in various possible locations
                      if (outputsData[0].results && outputsData[0].results.message) {
                        console.log('Found message in results.message');
                        outputText = outputsData[0].results.message.text || '';
                      } else if (outputsData[0].outputs && outputsData[0].outputs.message) {
                        console.log('Found message in outputs.message');
                        outputText = outputsData[0].outputs.message.message || '';
                      } else if (outputsData[0].messages && Array.isArray(outputsData[0].messages)) {
                        console.log('Found message in messages array');
                        outputText = outputsData[0].messages[0].message || '';
                      }
                    }
                  }
                  
                  // If we couldn't extract the text through the known paths, try the exact format from logs
                  if (!outputText) {
                    try {
                      console.log('Trying exact format from logs');
                      // Format seen in logs: outputs[0].outputs[0].results.message.text
                      if (langflowData.outputs && 
                          langflowData.outputs[0] && 
                          langflowData.outputs[0].outputs && 
                          langflowData.outputs[0].outputs[0] && 
                          langflowData.outputs[0].outputs[0].results && 
                          langflowData.outputs[0].outputs[0].results.message) {
                        
                        outputText = langflowData.outputs[0].outputs[0].results.message.text;
                        console.log('Successfully extracted text using exact path from logs');
                      }
                    } catch (pathError) {
                      console.error('Error accessing exact path:', pathError);
                    }
                  }
                  
                  // If still no text found, try a recursive search for any text field
                  if (!outputText) {
                    console.log('Attempting recursive search for text field');
                    
                    // Helper function to recursively search for text fields
                    const findTextInObject = (obj: any): string => {
                      if (!obj || typeof obj !== 'object') return '';
                      
                      // Check for common text field names
                      if (obj.text && typeof obj.text === 'string') return obj.text;
                      if (obj.message && typeof obj.message === 'string') return obj.message;
                      if (obj.content && typeof obj.content === 'string') return obj.content;
                      
                      // Recursively search in nested objects
                      for (const key in obj) {
                        if (typeof obj[key] === 'object') {
                          const found = findTextInObject(obj[key]);
                          if (found) return found;
                        }
                      }
                      
                      return '';
                    };
                    
                    outputText = findTextInObject(langflowData);
                    if (outputText) {
                      console.log('Found text through recursive search:', outputText.substring(0, 30) + '...');
                    }
                  }
                  
                  // If still no text found, use a default message
                  if (!outputText) {
                    console.warn('Could not extract message text from Langflow response:', langflowData);
                    outputText = 'Received a response from the assistant, but could not extract the message text.';
                  } else {
                    console.log('Successfully extracted message text:', outputText.substring(0, 50) + '...');
                  }
                } catch (parseError) {
                  console.error('Error parsing nested Langflow response:', parseError);
                  outputText = eventData.output; // Fall back to the raw output
                }
              } else {
                // Use the output directly if it's not a nested Langflow response
                outputText = eventData.output || eventData.data?.output || '';
                console.log('Using direct output:', outputText.substring(0, 50) + '...');
              }
              
              fullResponse += outputText;
              
              // Update the assistant message with the accumulated response
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === tempAssistantMessageId 
                    ? { ...msg, text: fullResponse, isLoading: false } 
                    : msg
                )
              );
            } catch (error) {
              console.error('Error parsing SSE message:', error);
              // Update the assistant message with the error
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === tempAssistantMessageId 
                    ? { 
                        ...msg, 
                        text: `Error: ${error.message}`, 
                        isLoading: false 
                      } 
                    : msg
                )
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in chat:', error);
      
      // Show error message
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempAssistantMessageId 
            ? { 
                ...msg, 
                text: 'Sorry, I encountered an error while processing your request.', 
                isLoading: false 
              } 
            : msg
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-5 right-5 w-96 h-[70vh] bg-white rounded-lg shadow-xl flex flex-col overflow-hidden z-50 border border-gray-200">
      {/* Chat Header */}
      <div className="p-3 bg-primary text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaRobot size={18} />
          <h2 className="font-semibold">{assistantName}</h2>
        </div>
        <button onClick={onClose} className="text-white hover:text-gray-200">
          <IoClose size={20} />
        </button>
      </div>
      
      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] p-3 rounded-lg ${
                  msg.sender === 'user' 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-gray-200 text-gray-800 rounded-tl-none'
                }`}
              >
                {msg.isLoading ? (
                  <div className="flex space-x-1 h-5 items-center">
                    <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                )}
                <div className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-primary-foreground/70' : 'text-gray-500'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          
          {/* Typing indicator */}
          {isTyping && !messages.some(m => m.isLoading) && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-800 p-3 rounded-lg rounded-tl-none max-w-[80%]">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Chat Input */}
      <form onSubmit={(e) => e.preventDefault()} className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type your message..."
          className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isTyping}
        />
        <Button 
          type="button" 
          size="icon" 
          variant="ghost" 
          className="text-gray-500 hover:text-gray-700"
          disabled={isTyping}
        >
          <AiOutlinePaperClip size={20} />
        </Button>
        <Button 
          type="button" 
          size="icon" 
          variant="ghost" 
          className="text-gray-500 hover:text-gray-700"
          disabled={isTyping}
        >
          <AiOutlineAudio size={20} />
        </Button>
        <Button 
          type="button" 
          size="icon" 
          className="bg-primary text-white hover:bg-primary/90"
          disabled={!message.trim() || isTyping}
          onClick={() => sendMessage(message)}
        >
          <IoSend size={18} />
        </Button>
      </form>
    </div>
  );
}