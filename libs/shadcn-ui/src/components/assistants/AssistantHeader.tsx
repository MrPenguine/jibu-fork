import React, { useState } from "react";
import { Button } from "../ui/button";
import { AssistantChat } from "../chat";

interface AssistantHeaderProps {
  assistantName: string;
  assistantId?: string;
  knowledgeBaseId?: string;
  selectedProvider: string;
  autosaveStatus?: React.ReactNode;
}

export function AssistantHeader({ assistantName, assistantId, knowledgeBaseId, selectedProvider, autosaveStatus }: AssistantHeaderProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleChatClick = () => {
    setIsChatOpen(true);
    console.log('Opening chat directly');
  };

  const handleChatClose = () => {
    setIsChatOpen(false);
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white">
      <div className="flex items-center">
        <h1 className="text-xl font-bold">{assistantName}</h1>
        {assistantId && (
          <div className="ml-2 text-xs text-gray-500">
            <span className="opacity-80">{assistantId}</span>
            <button className="ml-2 text-gray-400 hover:text-gray-600" aria-label="Copy ID">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button className="ml-2 text-gray-400 hover:text-gray-600" aria-label="Link">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center space-x-3">
        {/* Autosave indicator */}
        {autosaveStatus && (
          <div className="text-xs text-muted-foreground mr-3">
            {autosaveStatus}
          </div>
        )}
        
        {/* Test button */}
        <Button variant="outline" size="sm" className="border border-gray-600 rounded-full bg-transparent">
          Test
          <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </Button>
        
        {/* Chat button */}
        <Button 
          variant="outline" 
          size="sm" 
          className="border border-gray-600 rounded-full bg-transparent"
          onClick={handleChatClick}
        >
          Chat
          <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </Button>
        
        {/* Talk to Assistant button */}
        <Button variant="outline" size="sm" className="border border-primary text-primary rounded-full bg-transparent hover:bg-primary/10">
          Talk to Assistant
          <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </Button>
      </div>
      
      {/* Chat component */}
      {assistantId && isChatOpen && (
        <AssistantChat
          assistantId={assistantId}
          assistantName={assistantName}
          knowledgeBaseId={knowledgeBaseId}
          isOpen={isChatOpen}
          onClose={handleChatClose}
        />
      )}
    </div>
  );
}