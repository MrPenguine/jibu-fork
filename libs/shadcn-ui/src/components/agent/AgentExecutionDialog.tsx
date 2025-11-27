"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send, X, MessageCircle, Mic } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { useToast } from '../ui/use-toast';
import * as chatApi from '../../../../../apps/frontend/src/utils/chatApi';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface AgentExecutionDialogProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
  agentApi: any;
  workflowId?: string;
}

export function AgentExecutionDialog({ 
  agentId, 
  isOpen, 
  onClose,
  agentApi,
  workflowId,
}: AgentExecutionDialogProps) {
  const [agent, setAgent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChatBubble, setShowChatBubble] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch agent data and validate it's published
  const fetchAgentData = useCallback(async () => {
    if (!agentId || !isOpen) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await agentApi.getAgent(agentId);
      setAgent(data);
      if (!data.isPublished) {
        setError('This agent is not published. Please publish it before testing.');
        toast({
          title: 'Agent Not Published',
          description: 'Please publish the agent before testing.',
          variant: 'destructive',
        });
        setTimeout(() => onClose(), 3000);
        return;
      }
      // Add welcome message
      setMessages([{
        id: '1',
        text: `Hey! I'm ${data.name}. How can I help you today?`,
        sender: 'assistant',
        timestamp: new Date(),
      }]);
    } catch (error: any) {
      console.error('Failed to fetch agent:', error);
      setError(`Failed to load agent: ${error.message || 'Unknown error'}`);
      toast({
        title: 'Error',
        description: `Failed to load agent: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
      setTimeout(() => onClose(), 3000);
    }
    setIsLoading(false);
  }, [agentId, isOpen, onClose, agentApi, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchAgentData();
    }
  }, [isOpen, fetchAgentData]);

  // Reset state when dialog is closed
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setInputValue('');
      setError(null);
      setAgent(null);
      setShowChatBubble(false);
      setChatId(null);
    }
  }, [isOpen]);

  const handleStartChat = async () => {
    // Lazily create a backend Chat bound to this agent (and workflow if provided)
    try {
      if (!chatId) {
        const created = await chatApi.createChat(agentId, undefined, undefined, true, workflowId);
        if (created) {
          setChatId(created.id);
        }
      }
    } catch (error) {
      console.error('Failed to create diagnostic chat session:', error);
    }

    // Initialize UI with welcome message
    setMessages([{
      id: '1',
      text: `Hey! I'm ${agent?.name || 'your assistant'}. How can I help you today?`,
      sender: 'assistant',
      timestamp: new Date(),
    }]);
    setShowChatBubble(true);
  };

  const handleStartVoice = () => {
    toast({
      title: 'Voice Mode',
      description: 'Voice mode is coming soon!',
    });
  };

  const handleCloseChatBubble = () => {
    setShowChatBubble(false);
    setMessages([]);
    setInputValue('');
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');

    // Ensure we have a backend Chat for diagnostics
    let currentChatId = chatId;
    try {
      if (!currentChatId) {
        const created = await chatApi.createChat(agentId, undefined, undefined, true, workflowId);
        if (created) {
          currentChatId = created.id;
          setChatId(created.id);
        }
      }

      if (currentChatId) {
        try {
          await chatApi.sendChatMessage(currentChatId, currentInput, 'user');
        } catch (diagError) {
          console.error('Error sending diagnostic chat message to backend:', diagError);
        }
      }
    } catch (error) {
      console.error('Error ensuring diagnostic chat session:', error);
    }

    // Existing simulated assistant response (UI only)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Thanks for your message! I am processing your request...',
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Main Modal with Start Chat and Voice Mode buttons */}
      <Dialog open={isOpen && !showChatBubble} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Test Agent Execution</DialogTitle>
            <DialogDescription>
              {isLoading ? 'Loading agent...' : error ? 'Error loading agent' : `Choose how you want to interact with ${agent?.name || 'the agent'}`}
            </DialogDescription>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="py-4 text-center text-destructive">
              <p>{error}</p>
            </div>
          ) : (
            <div className="flex gap-3 py-4">
              <Button
                onClick={handleStartChat}
                className="flex-1 flex items-center justify-center gap-2 rounded-full"
                size="sm"
              >
                <MessageCircle className="h-4 w-4" />
                Start Chat
              </Button>
              <Button
                onClick={handleStartVoice}
                variant="outline"
                className="flex-1 flex items-center justify-center gap-2 rounded-full"
                size="sm"
              >
                <Mic className="h-4 w-4" />
                Voice Mode
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Chat Bubble */}
      {showChatBubble && (
        <div className="fixed bottom-6 right-6 z-50 font-sans">
          <Card className="w-96 h-[500px] flex flex-col shadow-lg border border-border bg-card">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-card-foreground">
                    {agent?.name || 'Assistant'}
                  </p>
                  <p className="text-xs text-muted-foreground">Online</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCloseChatBubble} className="h-6 w-6 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-muted-foreground rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.sender === 'user'
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground/70'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter message..."
                  className="flex-1"
                />
                <Button size="sm" onClick={handleSendMessage} className="px-3">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
