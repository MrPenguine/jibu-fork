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
  isOpen: boolean;
  onClose: () => void;
}

export function AssistantChat({ assistantId, assistantName, isOpen, onClose }: AssistantChatProps) {
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

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim()) return;

    // Generate unique ID for new message
    const newMessageId = Date.now().toString();
    const userMessage: Message = { 
      id: newMessageId, 
      text: message, 
      sender: 'user', 
      timestamp: new Date() 
    };
    
    // Add user message to chat
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    
    // Add typing indicator
    setIsTyping(true);
    
    // Simulate assistant response (replace with actual API call)
    try {
      // For now, just simulate a delay before response
      setTimeout(() => {
        const assistantResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: `This is a simulated response to: "${userMessage.text}"`,
          sender: 'assistant',
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, assistantResponse]);
        setIsTyping(false);
      }, 1500);
      
      // TODO: Replace with actual API call to backend
      // const response = await fetch(`/api/assistants/${assistantId}/chat`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ message: userMessage.text }),
      // });
      // 
      // if (!response.ok) throw new Error('Failed to get response');
      // 
      // const responseData = await response.json();
      // const assistantResponse: Message = {
      //   id: (Date.now() + 1).toString(),
      //   text: responseData.response,
      //   sender: 'assistant',
      //   timestamp: new Date(),
      // };
      // 
      // setMessages(prev => [...prev, assistantResponse]);
      // setIsTyping(false);
      
    } catch (error) {
      console.error('Error getting response:', error);
      setIsTyping(false);
      
      // Add error message
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error while processing your request.',
        sender: 'assistant',
        timestamp: new Date(),
      }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
                <p className="text-sm">{msg.text}</p>
                <div className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-primary-foreground/70' : 'text-gray-500'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          
          {/* Typing indicator */}
          {isTyping && (
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
      <form onSubmit={sendMessage} className="p-3 bg-white border-t border-gray-200 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type your message..."
          className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button 
          type="button" 
          size="icon" 
          variant="ghost" 
          className="text-gray-500 hover:text-gray-700"
        >
          <AiOutlinePaperClip size={20} />
        </Button>
        <Button 
          type="button" 
          size="icon" 
          variant="ghost" 
          className="text-gray-500 hover:text-gray-700"
        >
          <AiOutlineAudio size={20} />
        </Button>
        <Button 
          type="submit" 
          size="icon" 
          className="bg-primary text-white hover:bg-primary/90"
          disabled={!message.trim()}
        >
          <IoSend size={18} />
        </Button>
      </form>
    </div>
  );
} 