"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@libs/shadcn-ui/components/ui/dialog"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Input } from "@libs/shadcn-ui/components/ui/input"
import { Label } from "@libs/shadcn-ui/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@libs/shadcn-ui/components/ui/radio-group"
import { CheckCircle2, UserCircle, ShoppingBag, Headset, PlusCircle, Calendar, Book, Heart, Coffee, Edit, Briefcase } from "lucide-react"
import { createAssistant } from "../../../../../apps/frontend/src/utils/AssistantsApi"
import { useRouter } from "next/navigation"

type Template = {
  id: string
  name: string
  description: string
  icon: React.ReactNode
}

const blankTemplate: Template = {
  id: "blank",
  name: "Blank Assistant",
  description: "Start from scratch with a blank assistant",
  icon: <PlusCircle className="h-10 w-10 text-gray-400" />
}

const assistantTemplates: Template[] = [
  {
    id: "customer-support",
    name: "Customer Support",
    description: "Handle customer inquiries and support requests",
    icon: <Headset className="h-10 w-10 text-blue-500" />
  },
  {
    id: "sales",
    name: "Sales Assistant",
    description: "Help customers through the sales process",
    icon: <ShoppingBag className="h-10 w-10 text-green-500" />
  },
  {
    id: "scheduling",
    name: "Scheduling Assistant",
    description: "Manage appointments and scheduling",
    icon: <Calendar className="h-10 w-10 text-purple-500" />
  },
  {
    id: "education",
    name: "Education Assistant",
    description: "Help with learning and educational resources",
    icon: <Book className="h-10 w-10 text-amber-500" />
  },
  {
    id: "health",
    name: "Health Coach",
    description: "Provide health and wellness guidance",
    icon: <Heart className="h-10 w-10 text-red-500" />
  },
  {
    id: "personal",
    name: "Personal Assistant",
    description: "Manage personal tasks and reminders",
    icon: <UserCircle className="h-10 w-10 text-indigo-500" />
  },
  {
    id: "content",
    name: "Content Writer",
    description: "Assist with content creation and editing",
    icon: <Edit className="h-10 w-10 text-teal-500" />
  },
  {
    id: "business",
    name: "Business Analyst",
    description: "Provide business insights and analytics",
    icon: <Briefcase className="h-10 w-10 text-gray-700" />
  }
]

interface CreateAssistantModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateAssistant: (name: string, templateId: string) => void
}

export function CreateAssistantModal({ isOpen, onClose, onCreateAssistant }: CreateAssistantModalProps) {
  const [assistantName, setAssistantName] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState("blank")
  const [nameError, setNameError] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()
  
  // Track if using blank or predefined template
  const isUsingBlank = selectedTemplate === "blank"
  
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!assistantName.trim()) {
      setNameError("Assistant name is required")
      return
    }
    
    setIsCreating(true)
    try {
      // Default values for first message and system prompt based on selected template
      const description = selectedTemplate === "blank" 
        ? "[placeholder, replace with actual first message]::Thank you for calling Wellness Partners. This is Riley, your scheduling assistant. How may I help you today?" 
        : assistantTemplates.find(t => t.id === selectedTemplate)?.description || "A blank assistant";
      
      const systemPrompt = "{# Appointment Scheduling Agent Prompt\n\n## Identity & Purpose\n\nYou are Riley, an appointment scheduling voice assistant for Wellness Partners, a multi-specialty health clinic. Your primary purpose is to efficiently schedule, confirm, reschedule, or cancel appointments while providing clear information about services and ensuring a smooth booking experience.";
      
      // Create the assistant using the API
      const assistant = await createAssistant({
        name: assistantName,
        templateId: selectedTemplate,
        description,
        systemPrompt
      })
      
      // Call the onCreateAssistant callback with the new assistant
      if (onCreateAssistant) {
        onCreateAssistant(assistantName, selectedTemplate)
      }
      
      // Reset form
      setAssistantName("")
      setSelectedTemplate("blank")
      setNameError("")
      
      // Close the modal
      onClose()
      
      // Redirect to the new assistant page
      if (assistant?.id) {
        router.push(`/assistants/${assistant.id}`)
      }
    } catch (error) {
      console.error("Error creating assistant:", error)
      setNameError("Failed to create assistant. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Create a new assistant</DialogTitle>
          <DialogDescription>
            Give your assistant a name and choose a template to get started.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="assistant-name" className="text-sm font-medium">
              Assistant Name
            </Label>
            <Input
              id="assistant-name"
              value={assistantName}
              onChange={(e) => {
                setAssistantName(e.target.value)
                if (e.target.value.trim()) setNameError("")
              }}
              className={`w-full rounded-xl ${nameError ? "border-red-500" : ""}`}
              placeholder="My Assistant"
            />
            {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
          </div>
          
          <div className="space-y-4">
            <Label className="text-sm font-medium">Choose a template</Label>
            
            {/* Blank template */}
            <div
              className={`flex items-start space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                isUsingBlank 
                  ? "border-primary bg-primary/5" 
                  : "border-gray-100 hover:bg-gray-50"
              }`}
              onClick={() => handleTemplateSelect("blank")}
            >
              <div className="shrink-0">{blankTemplate.icon}</div>
              <div className="space-y-1">
                <Label 
                  className="block text-sm font-medium cursor-pointer"
                >
                  {blankTemplate.name}
                </Label>
                <p className="text-gray-500 text-xs">
                  {blankTemplate.description}
                </p>
                {isUsingBlank && (
                  <div className="text-primary text-xs flex items-center mt-1">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Selected
                  </div>
                )}
              </div>
            </div>
            
            {/* Template collection */}
            <div className="rounded-xl border-2 border-gray-100 p-4">
              <h3 className="text-sm font-medium mb-3">Pre-built Templates</h3>
              <div className="max-h-[360px] overflow-y-auto pr-1 space-y-3 rounded-lg">
                {assistantTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedTemplate === template.id 
                        ? "border-primary bg-primary/5" 
                        : "border-gray-100 hover:bg-gray-50"
                    }`}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <div className="shrink-0">{template.icon}</div>
                    <div className="space-y-1">
                      <Label 
                        className="block text-sm font-medium cursor-pointer"
                      >
                        {template.name}
                      </Label>
                      <p className="text-gray-500 text-xs">
                        {template.description}
                      </p>
                      {selectedTemplate === template.id && (
                        <div className="text-primary text-xs flex items-center mt-1">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Selected
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={onClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="rounded-xl"
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <span className="mr-2">Creating...</span>
                  <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </>
              ) : (
                "Create Assistant"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 