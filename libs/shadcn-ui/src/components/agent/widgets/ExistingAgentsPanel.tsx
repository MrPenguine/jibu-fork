"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card"
import { Bot, Folder, MoreVertical, PenSquare, Play, Trash2 } from "lucide-react"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@libs/shadcn-ui/components/ui/dropdown-menu"
import { Badge } from "@libs/shadcn-ui/components/ui/badge"
import { ScrollArea } from "@libs/shadcn-ui/components/ui/scroll-area"

export interface AgentItem {
  id: string
  name: string
  description: string
  type: string
  lastUpdated: string
}

export interface FolderItem {
  id: string
  name: string
  agents: AgentItem[]
}

export interface ExistingAgentsPanelProps {
  folders: FolderItem[]
  agents: AgentItem[]
  onEditAgent?: (agentId: string) => void
  onDeleteAgent?: (agentId: string) => void
  onRunAgent?: (agentId: string) => void
  onDeleteFolder?: (folderId: string) => void
}

export function ExistingAgentsPanel({
  folders = [],
  agents = [],
  onEditAgent,
  onDeleteAgent,
  onRunAgent,
  onDeleteFolder
}: ExistingAgentsPanelProps) {
  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Existing Agents</CardTitle>
        <CardDescription>Your created agents and folders</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {folders.length === 0 && agents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>No agents or folders created yet</p>
              <p className="text-sm mt-1">Create your first agent to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Folders */}
              {folders.map((folder) => (
                <div key={folder.id} className="border rounded-lg">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-t-lg border-b">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-slate-500" />
                      <span className="font-medium">{folder.name}</span>
                      <Badge variant="outline" className="ml-2">{folder.agents.length}</Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => onDeleteFolder?.(folder.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Folder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="p-2">
                    {folder.agents.map((agent) => (
                      <AgentCard 
                        key={agent.id} 
                        agent={agent} 
                        onEdit={() => onEditAgent?.(agent.id)}
                        onDelete={() => onDeleteAgent?.(agent.id)}
                        onRun={() => onRunAgent?.(agent.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              
              {/* Ungrouped agents */}
              {agents.map((agent) => (
                <AgentCard 
                  key={agent.id} 
                  agent={agent} 
                  onEdit={() => onEditAgent?.(agent.id)}
                  onDelete={() => onDeleteAgent?.(agent.id)}
                  onRun={() => onRunAgent?.(agent.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function AgentCard({ 
  agent, 
  onEdit, 
  onDelete, 
  onRun 
}: { 
  agent: AgentItem, 
  onEdit?: () => void, 
  onDelete?: () => void,
  onRun?: () => void
}) {
  return (
    <div className="border rounded-md p-3 mb-2 bg-white hover:bg-slate-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="font-medium">{agent.name}</span>
          <Badge variant="outline" className="ml-1">{agent.type}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRun}>
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <PenSquare className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <PenSquare className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{agent.description}</p>
      <div className="text-xs text-muted-foreground mt-2">
        Last updated: {agent.lastUpdated}
      </div>
    </div>
  )
}
