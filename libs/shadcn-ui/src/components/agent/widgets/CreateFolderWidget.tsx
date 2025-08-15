"use client"

import * as React from "react"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card"
import { FolderPlus } from "lucide-react"
import { Input } from "@libs/shadcn-ui/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@libs/shadcn-ui/components/ui/dialog"
import { Label } from "@libs/shadcn-ui/components/ui/label"

export interface CreateFolderWidgetProps {
  onCreateFolder?: (folderName: string) => void
}

export function CreateFolderWidget({ onCreateFolder }: CreateFolderWidgetProps) {
  const [open, setOpen] = React.useState(false)
  const [folderName, setFolderName] = React.useState("")
  
  const handleCreateFolder = () => {
    if (folderName.trim()) {
      onCreateFolder?.(folderName.trim())
      setFolderName("")
      setOpen(false)
    }
  }

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Create Folder</CardTitle>
        <CardDescription>Organize your agents into folders</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full flex items-center gap-2">
              <FolderPlus className="h-4 w-4" />
              <span>New Folder</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new folder</DialogTitle>
              <DialogDescription>
                Enter a name for your new folder to organize your agents.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="folderName">Folder Name</Label>
              <Input 
                id="folderName" 
                value={folderName} 
                onChange={(e) => setFolderName(e.target.value)} 
                placeholder="My Agents Folder"
                className="mt-2"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateFolder}>Create Folder</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
