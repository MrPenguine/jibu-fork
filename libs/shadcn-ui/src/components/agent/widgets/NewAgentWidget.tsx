"use client"

import * as React from "react"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card"
import { Bot, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@libs/shadcn-ui/components/ui/dialog"
import { Input } from "@libs/shadcn-ui/components/ui/input"
import { Label } from "@libs/shadcn-ui/components/ui/label"
import { Textarea } from "@libs/shadcn-ui/components/ui/textarea"

export interface NewAgentWidgetProps {
  onCreateAgent?: (agent: { name: string; description: string }) => void
}

export function NewAgentWidget({ onCreateAgent }: NewAgentWidgetProps) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  
  const handleCreateAgent = () => {
    if (name.trim()) {
      onCreateAgent?.({ name: name.trim(), description: description.trim() })
      setName("")
      setDescription("")
      setOpen(false)
    }
  }

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">New Agent</CardTitle>
        <CardDescription>Create a new AI agent</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Create Agent</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create a new agent</DialogTitle>
              <DialogDescription>
                Enter the details for your new AI agent.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="My AI Assistant"
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Describe what this agent will do..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateAgent} disabled={!name.trim()}>Create Agent</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
