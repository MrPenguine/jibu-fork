"use client"

import * as React from "react"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card"
import { Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@libs/shadcn-ui/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@libs/shadcn-ui/components/ui/select"
import { Label } from "@libs/shadcn-ui/components/ui/label"
import { AlertTriangle } from "lucide-react"

export interface Agent {
  id: string
  name: string
}

export interface DeleteAgentWidgetProps {
  agents: Agent[]
  onDeleteAgent?: (agentId: string) => void
}

export function DeleteAgentWidget({ agents, onDeleteAgent }: DeleteAgentWidgetProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedAgentId, setSelectedAgentId] = React.useState<string>("")
  
  const handleDeleteAgent = () => {
    if (selectedAgentId) {
      onDeleteAgent?.(selectedAgentId)
      setSelectedAgentId("")
      setOpen(false)
    }
  }

  const hasAgents = agents.length > 0

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Delete Agent</CardTitle>
        <CardDescription>Remove an existing agent</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full flex items-center gap-2" disabled={!hasAgents}>
              <Trash2 className="h-4 w-4" />
              <span>Delete Agent</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete an agent</DialogTitle>
              <DialogDescription>
                Select an agent to delete. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="agent">Select Agent</Label>
              <Select 
                value={selectedAgentId} 
                onValueChange={setSelectedAgentId}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedAgentId && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  <p className="text-sm text-red-700">
                    This will permanently delete the agent and all associated data. This action cannot be undone.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteAgent} disabled={!selectedAgentId}>
                Delete Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
