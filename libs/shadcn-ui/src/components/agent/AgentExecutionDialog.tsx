"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { AgentNodeType } from '../../types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertCircle, Info, Loader2, MessageSquare, Mic } from 'lucide-react';
import { Badge } from '../ui/badge';
import AgentChat from './AgentChat';

interface AgentExecutionDialogProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
  agentApi: any;
}

export function AgentExecutionDialog({ 
  agentId, 
  isOpen, 
  onClose,
  agentApi 
}: AgentExecutionDialogProps) {
  // References
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [agent, setAgent] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [choices, setChoices] = useState<any[]>([]);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'running' | 'waiting' | 'error' | 'completed'>('idle');
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [executionPath, setExecutionPath] = useState<{nodeId: string, timestamp: Date}[]>([]);
  
  // Chat states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);

  // Fetch agent data
  const fetchAgentData = useCallback(async () => {
    if (!agentId || !isOpen) return;
    setIsLoading(true);
    setError(null);
    setStatus('loading');
    try {
      const data = await agentApi.getAgent(agentId);
      setAgent(data);
      if (!data.isPublished) {
        setError('This agent is not published. Please publish it before running.');
        setStatus('error');
        setTimeout(() => onClose(), 2000);
        return;
      }
      setStatus('idle');
    } catch (error: any) {
      console.error('Failed to fetch agent:', error);
      setError(`Failed to load agent: ${error.message || 'Unknown error'}`);
      setStatus('error');
      setTimeout(() => onClose(), 2000);
    }
    setIsLoading(false);
  }, [agentId, isOpen, onClose, agentApi]);

  useEffect(() => {
    fetchAgentData();
  }, [fetchAgentData]);

  // Reset state when dialog is opened
  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setChoices([]);
      setWaitingForInput(false);
      setCurrentNodeId(null);
      setSession(null);
      setIsChatOpen(false);
      setChatId(null);
    }
  }, [isOpen]);

  // Start agent session
  const startAgent = async () => {
    setStatus('loading');
    setError(null);
    try {
      const sessionData = await agentApi.executeAgent(agentId, { initialVariables: {} });
      setSession(sessionData);
      setStatus('running');
      processSessionState(sessionData);
      
      // Store initial variables if available
      if (sessionData.variables) {
        setVariables(sessionData.variables);
      }
    } catch (error: any) {
      console.error('Failed to start agent:', error);
      setError(`Failed to start agent: ${error.message || 'Unknown error'}`);
      setStatus('error');
    }
  };
  
  // Start agent chat mode
  const startAgentChat = () => {
    setIsChatOpen(true);
    // The AgentChat component will handle creating a new chat or loading existing
  };
  
  // Start agent voice mode (placeholder for future implementation)
  const startAgentVoice = () => {
    // This will be implemented in the future
    alert('Voice mode is coming soon!');
  };

  // Continue agent session
  const continueAgent = async (input?: string) => {
    if (!session) return;
    
    setStatus('running');
    setError(null);
    try {
      const sessionData = await agentApi.continueAgentSession(
        session.id,
        input !== undefined ? { userInput: input } : {}
      );
      setSession(sessionData);
      processSessionState(sessionData);
      
      // Update variables if available
      if (sessionData.variables) {
        setVariables(sessionData.variables);
      }
    } catch (error: any) {
      console.error('Failed to continue agent:', error);
      setError(`Failed to continue agent: ${error.message || 'Unknown error'}`);
      setStatus('error');
    }
  };

  // Process session state
  const processSessionState = (sessionData: any) => {
    // Update status based on session state
    if (sessionData.status === 'completed') {
      setStatus('completed');
    } else if (sessionData.status === 'waiting') {
      setStatus('waiting');
    } else {
      setStatus('running');
    }
    
    // Track execution path
    if (sessionData.currentNodeId && !executionPath.some(item => item.nodeId === sessionData.currentNodeId)) {
      setExecutionPath(prev => [...prev, {
        nodeId: sessionData.currentNodeId,
        timestamp: new Date()
      }]);
    }
    // Update messages based on history
    const history = sessionData.history || [];
    const newMessages = [...messages];
    
    // Process new history items
    history.forEach((item: any) => {
      if (item.nodeType === AgentNodeType.MESSAGE && item.output?.message) {
        // Check if this message is already in our list
        const messageExists = newMessages.some(
          (msg) => msg.nodeId === item.nodeId && msg.text === item.output.message
        );
        
        if (!messageExists) {
          newMessages.push({
            nodeId: item.nodeId,
            text: item.output.message,
            sender: 'agent',
            timestamp: new Date(item.timestamp),
          });
        }
      }
    });
    
    setMessages(newMessages);

    // Check current node type
    if (sessionData.currentNodeId) {
      setCurrentNodeId(sessionData.currentNodeId);
      
      // Parse nodes if they're stored as a string
      let nodes = [];
      try {
        if (agent?.nodes && typeof agent.nodes === 'string') {
          nodes = JSON.parse(agent.nodes);
        } else if (Array.isArray(agent?.nodes)) {
          nodes = agent.nodes;
        }
      } catch (error) {
        console.error('Error parsing agent nodes:', error);
        nodes = [];
      }
      
      // Find current node
      const currentNode = nodes.find((node: any) => node.id === sessionData.currentNodeId);
      
      if (currentNode) {
        // Handle different node types
        switch (currentNode.type) {
          case AgentNodeType.LISTEN:
            setWaitingForInput(true);
            setChoices([]);
            setStatus('waiting');
            break;
            
          case AgentNodeType.CHOICE:
            setWaitingForInput(false);
            // Extract choices from node data
            const nodeChoices = currentNode.data?.choices || [];
            setChoices(nodeChoices);
            break;
            
          default:
            setWaitingForInput(false);
            setChoices([]);
        }
      }
    } else {
      // Agent has ended
      setCurrentNodeId(null);
      setWaitingForInput(false);
      setChoices([]);
    }
  };

  // Handle user input submission
  const handleSubmitInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() && waitingForInput) return;
    
    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      {
        text: userInput,
        sender: 'user',
        timestamp: new Date(),
      },
    ]);
    
    // Continue agent with user input
    continueAgent(userInput);
    setUserInput('');
    setWaitingForInput(false);
  };

  // Handle choice selection
  const handleChoiceSelect = (choice: any) => {
    // Add choice to chat
    setMessages((prev) => [
      ...prev,
      {
        text: choice.label,
        sender: 'user',
        timestamp: new Date(),
      },
    ]);
    
    // Continue agent with choice value
    continueAgent(choice.value);
    setChoices([]);
  };

  // Restart agent
  const handleRestartAgent = () => {
    if (confirm('Are you sure you want to restart the agent? All progress will be lost.')) {
      setMessages([]);
      setChoices([]);
      setWaitingForInput(false);
      setCurrentNodeId(null);
      setSession(null);
      setVariables({});
      setError(null);
      setExecutionPath([]);
      startAgent();
    }
  };

  // Toggle debug mode
  const [debugMode, setDebugMode] = useState(false);
  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Focus input when waiting for input
  useEffect(() => {
    if (waitingForInput && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [waitingForInput]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, choices]);

  // Start agent automatically when dialog opens and agent data is available
  useEffect(() => {
    if (agent && !session && agent.isPublished && isOpen) {
      startAgent();
    }
  }, [agent, session, isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC key to close dialog
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Status indicator component
  const StatusIndicator = () => {
    switch (status) {
      case 'loading':
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading
          </Badge>
        );
      case 'running':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running
          </Badge>
        );
      case 'waiting':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-300">
            <Info className="h-3 w-3" />
            Waiting for input
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-red-50 text-red-700 border-red-300">
            <AlertCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-green-50 text-green-700 border-green-300">
            <Info className="h-3 w-3" />
            Completed
          </Badge>
        );
      default:
        return null;
    }
  };

  // Auto-hide error after 5 seconds if not in debug mode
  useEffect(() => {
    if (error && !debugMode) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, debugMode]);

  return (
    <>
      {/* Show either the execution dialog or the chat component based on isChatOpen */}
      {isChatOpen && isOpen && agent ? (
        // Agent Chat Component - Only shown when chat is opened
        <AgentChat
          agentId={agentId}
          agentName={agent?.name || 'Agent'}
          chatId={chatId}
          isOpen={true}
          onClose={() => {
            setIsChatOpen(false); // Go back to main dialog instead of fully closing
          }}
        />
      ) : (
        // Main Execution Dialog
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {agent ? agent.name : 'Loading agent...'}
              {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
              {status === 'error' && <span className="text-red-500 text-sm font-normal px-2 py-1 rounded-md bg-red-50">Error</span>}
            </DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        
        <div className={`flex ${debugMode ? 'flex-row gap-4' : ''}`}>
          <div className={`flex-grow overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[50vh] border rounded-md ${debugMode ? 'w-1/2' : 'w-full'}`}>
          {messages.length === 0 && !session && !isLoading && (
            <div className="flex items-center justify-center h-full">
              <Button onClick={startAgent}>Start Agent</Button>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />

          {/* Show choices if available */}
          {choices.length > 0 && (
            <div className="flex flex-col gap-2 mt-4">
              <p className="text-sm text-muted-foreground">Select an option:</p>
              <div className="flex flex-wrap gap-2">
                {choices.map((choice, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    onClick={() => handleChoiceSelect(choice)}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

          {/* Debug panel */}
          {debugMode && (
            <div className="w-1/2 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[50vh] border rounded-md bg-slate-50">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Debug Information</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    // Copy debug info to clipboard
                    const debugInfo = {
                      sessionId: session?.id,
                      currentNodeId,
                      variables,
                      status,
                      executionPath
                    };
                    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
                  }}
                >
                  Copy Debug Info
                </Button>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">Current Node</h3>
                <pre className="text-xs bg-slate-100 p-2 rounded overflow-x-auto">
                  {currentNodeId || 'None'}
                </pre>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">Session ID</h3>
                <pre className="text-xs bg-slate-100 p-2 rounded overflow-x-auto">
                  {session?.id || 'No active session'}
                </pre>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">Variables</h3>
                <pre className="text-xs bg-slate-100 p-2 rounded overflow-x-auto">
                  {Object.keys(variables).length > 0 
                    ? JSON.stringify(variables, null, 2) 
                    : 'No variables'}
                </pre>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">Status</h3>
                <pre className="text-xs bg-slate-100 p-2 rounded overflow-x-auto">
                  {status}
                </pre>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">Execution Path</h3>
                {executionPath.length > 0 ? (
                  <div className="border rounded overflow-y-auto max-h-[150px]">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-200 sticky top-0">
                        <tr>
                          <th className="p-1 text-left">Step</th>
                          <th className="p-1 text-left">Node ID</th>
                          <th className="p-1 text-left">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {executionPath.map((step, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="p-1">{index + 1}</td>
                            <td className="p-1">
                              <span className={currentNodeId === step.nodeId ? 'font-bold text-blue-600' : ''}>
                                {step.nodeId}
                              </span>
                            </td>
                            <td className="p-1">{step.timestamp.toLocaleTimeString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No execution path recorded yet</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        {waitingForInput && (
          <div className="pt-4">
            <form onSubmit={handleSubmitInput} className="flex gap-2">
              <Input
                ref={inputRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-grow"
                disabled={status === 'error'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (userInput.trim()) {
                      handleSubmitInput(e as unknown as React.FormEvent);
                    }
                  }
                }}
              />
              <Button type="submit" disabled={status === 'error'}>Send</Button>
            </form>
          </div>
        )}

        <DialogFooter className="flex justify-between mt-4">
          <div>
            {status === 'completed' && (
              <p className="text-sm text-muted-foreground">Agent execution completed</p>
            )}
            {status === 'error' && (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs"
                onClick={() => {
                  setError(null);
                  setStatus('idle');
                }}
              >
                Clear Error
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {/* Agent interaction mode buttons */}
            <div className="flex mr-4">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={startAgentChat}
                title="Start chat with the agent"
              >
                <MessageSquare className="h-4 w-4" /> Start Chat
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1 ml-2"
                onClick={startAgentVoice}
                title="Start voice mode (coming soon)"
                disabled={true} // Disabled until implemented
              >
                <Mic className="h-4 w-4" /> Voice Mode
              </Button>
            </div>
            
            {/* Control buttons */}
            {session && (
              <Button 
                onClick={handleRestartAgent} 
                variant="outline"
                disabled={status === 'loading'}
                title="Restart the agent from the beginning"
              >
                Restart
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </>
  );
}
