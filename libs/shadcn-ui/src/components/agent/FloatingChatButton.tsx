"use client";

import React, { useState, useEffect } from 'react';
import { FaRobot, FaTimes } from "react-icons/fa";
import { Button } from "../ui/button";
import AgentChat from "./AgentChat";

interface FloatingChatButtonProps {
  agentId: string;
  agentName: string;
  knowledgeBaseId?: string;
  checkIsConfigured?: () => Promise<boolean>;
}

/**
 * A floating chat button that toggles an agent chat window
 */
export const FloatingChatButton = ({
  agentId,
  agentName,
  knowledgeBaseId,
  checkIsConfigured
}: FloatingChatButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAgentConfigured, setIsAgentConfigured] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  
  // Check if the agent is properly configured
  useEffect(() => {
    const checkAgentConfiguration = async () => {
      if (checkIsConfigured) {
        setIsChecking(true);
        try {
          const configured = await checkIsConfigured();
          setIsAgentConfigured(configured);
        } catch (error) {
          console.error('Error checking agent configuration:', error);
          setIsAgentConfigured(false);
        } finally {
          setIsChecking(false);
        }
      }
    };
    
    checkAgentConfiguration();
  }, [checkIsConfigured]);
  
  const toggleChat = () => {
    setIsOpen((prev) => !prev);
  };
  
  return (
    <>
      {/* Floating chat button */}
      <Button
        className="fixed right-6 bottom-6 rounded-full w-14 h-14 shadow-lg flex items-center justify-center z-50 bg-primary hover:bg-primary/90"
        onClick={toggleChat}
        aria-label={isOpen ? 'Close agent chat' : 'Open agent chat'}
      >
        {isOpen ? (
          <FaTimes size={24} className="text-white" />
        ) : (
          <FaRobot size={24} className="text-white" />
        )}
      </Button>
      
      {/* Agent Chat Component (conditionally rendered) */}
      {isOpen && (
        isAgentConfigured ? (
          <AgentChat
            agentId={agentId}
            agentName={agentName}
            knowledgeBaseId={knowledgeBaseId}
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
          />
        ) : (
          <div className="fixed bottom-5 right-5 w-96 h-[300px] z-50 bg-white rounded-lg shadow-lg flex flex-col">
            {/* Chat header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center">
                <FaRobot className="text-primary mr-2" size={18} />
                <h3 className="font-medium">{agentName || 'Agent'}</h3>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsOpen(false)}
                className="rounded-full"
              >
                <FaTimes size={18} />
              </Button>
            </div>
            
            {/* Configuration message */}
            <div className="flex-grow p-4 flex flex-col items-center justify-center text-center">
              <FaRobot size={40} className="text-gray-300 mb-4" />
              <h3 className="text-lg font-medium mb-2">Agent not ready</h3>
              <p className="text-gray-500">
                This agent is not published or fully configured. 
                Please publish both the workflow and agent before running.
              </p>
            </div>
          </div>
        )
      )}
    </>
  );
};
