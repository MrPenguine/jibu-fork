"use client"

import { useState } from "react"
import { Textarea } from "@libs/shadcn-ui/components/ui/textarea"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Slider } from "@libs/shadcn-ui/components/ui/slider"
import { Input } from "@libs/shadcn-ui/components/ui/input"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@libs/shadcn-ui/components/ui/dropdown-menu"
import { KnowledgeBaseConfig } from "./KnowledgeBaseConfig"

interface ModelConfigProps {
  firstMessage: string
  systemPrompt: string
  provider: string
  model: string
  temperature: number
  maxTokens: number
  assistantId?: string
  knowledgeBaseId?: string
  organizationId?: string
  onFirstMessageChange: (value: string) => void
  onSystemPromptChange: (value: string) => void
  onProviderChange: (value: string) => void
  onModelChange: (value: string) => void
  onTemperatureChange: (value: number) => void
  onMaxTokensChange: (value: number) => void
  onKnowledgeBaseChange?: (knowledgeBaseId: string | null) => void
}

export function ModelConfig({
  firstMessage,
  systemPrompt,
  provider,
  model,
  temperature,
  maxTokens,
  assistantId,
  knowledgeBaseId,
  organizationId,
  onFirstMessageChange,
  onSystemPromptChange,
  onProviderChange,
  onModelChange,
  onTemperatureChange,
  onMaxTokensChange,
  onKnowledgeBaseChange
}: ModelConfigProps) {
  // Add debug logging for props being passed to KnowledgeBaseConfig
  console.log(`[ModelConfig] Rendering with assistantId=${assistantId}, knowledgeBaseId=${knowledgeBaseId}, organizationId=${organizationId}`);
  
  // Add information about the current connection
  const connectedKbInfo = knowledgeBaseId ? 
    `Assistant connected to knowledge base: ${knowledgeBaseId}` : 
    "No knowledge base connected";

  if (organizationId) {
    console.log(`[ModelConfig] Using organization ID from props: ${organizationId}`);
  } else {
    console.log('[ModelConfig] No organization ID provided in props');
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex">
        {/* Main Configuration Area */}
        <div className="w-2/3 pr-6">
          <div className="flex items-center mb-2">
            <h2 className="text-xl font-bold">Model</h2>
            <div className="ml-2 text-muted-foreground">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Configure the behavior of the assistant. {connectedKbInfo}</p>
          
          {/* First Message */}
          <div className="mb-6">
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">First Message</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <Textarea 
              className="w-full" 
              value={firstMessage}
              onChange={(e) => onFirstMessageChange(e.target.value)}
              rows={3}
            />
          </div>
          
          {/* System Prompt */}
          <div className="mb-6">
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">System Prompt</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className="relative">
              <Textarea 
                className="w-full pr-10" 
                value={systemPrompt}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                rows={6}
              />
              <div className="absolute top-2 right-2">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 3H21M21 3V9M21 3L14 10M10 21H4M4 21V15M4 21L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Button>
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="outline" className="text-xs">
                Generate
              </Button>
            </div>
          </div>
          
          {/* Knowledge Base Section - Title moved outside component */}
          <div className="mt-6">
            <div className="flex items-center mb-2">
              <h2 className="text-xl font-bold">Knowledge Base</h2>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{connectedKbInfo}</p>
            
            {/* Knowledge Base Component - Made wider with width of 100% */}
            <div className="w-full">
              <KnowledgeBaseConfig
                assistantId={assistantId}
                knowledgeBaseId={knowledgeBaseId}
                organizationId={organizationId}
                onKnowledgeBaseChange={onKnowledgeBaseChange}
              />
            </div>
          </div>
        </div>
        
        {/* Right Settings Panel */}
        <div className="w-1/3 pl-6 space-y-6">
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Provider</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full bg-white rounded-full border justify-between">
                  {provider || "Select provider"}
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4">
                    <path d="M4.5 6.5L7.5 9.5L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={4} className="w-full border-0">
                <DropdownMenuItem onClick={() => onProviderChange("openai")}>openai</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onProviderChange("anthropic")}>anthropic</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Model</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full bg-white rounded-full border justify-between">
                  {model || "Select model"}
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 h-4 w-4">
                    <path d="M4.5 6.5L7.5 9.5L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={4} className="w-full border-0">
                <DropdownMenuItem onClick={() => onModelChange("gpt-4o")}>gpt-4o</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onModelChange("gpt-3.5-turbo")}>gpt-3.5-turbo</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Temperature</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Slider 
                className="w-full" 
                value={[temperature]} 
                min={0} 
                max={1} 
                step={0.1}
                onValueChange={(values) => onTemperatureChange(values[0])}
              />
              <span className="ml-2">{temperature}</span>
            </div>
          </div>
          
          <div>
            <div className="flex items-center mb-2">
              <label className="block text-xs font-bold uppercase">Max Tokens</label>
              <div className="ml-2 text-muted-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <Input 
              type="number" 
              className="w-full bg-white rounded-full border" 
              value={maxTokens}
              onChange={(e) => onMaxTokensChange(parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 