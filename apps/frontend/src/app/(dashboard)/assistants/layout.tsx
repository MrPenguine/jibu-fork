"use client"

import React, { useState, useEffect } from "react"
import { CreateAssistantModal } from "@libs/shadcn-ui/components/assistants/CreateAssistantModal"
import { useRouter, usePathname } from "next/navigation"
import { useOrganization } from "../../../utils/organizationContext"
import { Assistant, getAssistants } from "../../../utils/AssistantsApi"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Plus, FolderPlus } from "lucide-react"
import { Input } from "@libs/shadcn-ui/components/ui/input"

export default function AssistantsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { activeOrganization } = useOrganization()
  const router = useRouter()
  const pathname = usePathname()

  // Fetch assistants when active organization changes
  useEffect(() => {
    const fetchAssistants = async () => {
      if (!activeOrganization) return

      try {
        setIsLoading(true)
        const data = await getAssistants(activeOrganization.id)
        setAssistants(data)
      } catch (error) {
        console.error("Error fetching assistants:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAssistants()
  }, [activeOrganization])

  const handleAssistantSelect = (id: string) => {
    router.push(`/assistants/${id}`)
  }

  const handleCreateAssistant = (name: string, templateId: string) => {
    // This will be called after successfully creating an assistant
    // Refresh the assistants list
    if (activeOrganization) {
      getAssistants(activeOrganization.id)
        .then(data => setAssistants(data))
        .catch(error => console.error("Error refreshing assistants:", error))
    }
  }

  return (
    <div className={`relative flex h-screen bg-[#f7f7f8] ${isCreateModalOpen ? 'overflow-hidden' : ''}`}>
      {/* Backdrop blur when modal is open */}
      {isCreateModalOpen && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-40" />
      )}
      
      {/* Left Sidebar */}
      <div className="w-[280px] flex flex-col bg-white relative z-10">
        <div className="p-4">
          <div className="flex gap-2">
            <Button 
              className="flex-grow bg-primary hover:bg-primary/90 text-white rounded-xl font-medium flex items-center justify-center gap-1"
              onClick={() => setIsCreateModalOpen(true)}
              data-create-assistant-button
            >
              <Plus className="h-4 w-4" />
              CREATE ASSISTANT
            </Button>
            <div className="relative group">
              <Button 
                className="h-full px-3 rounded-xl border-primary text-primary hover:bg-primary/10 bg-transparent"
              >
                <FolderPlus className="h-4 w-4" />
                <span className="absolute left-1/2 -translate-x-1/2 -top-12 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  Create Folder
                </span>
              </Button>
            </div>
          </div>
          <div className="mt-4 relative">
            <Input
              placeholder="Search Assistants"
              className="rounded-full border border-gray-300"
            />
          </div>
        </div>
        <div className="mt-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-pulse flex flex-col space-y-4 w-[90%]">
                <div className="h-8 bg-gray-200 rounded-xl w-full"></div>
                <div className="h-8 bg-gray-200 rounded-xl w-full"></div>
                <div className="h-8 bg-gray-200 rounded-xl w-full"></div>
              </div>
            </div>
          ) : assistants.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No assistants yet.<br />
              Create your first assistant above.
            </div>
          ) : (
            assistants.map((assistant) => {
              const isActive = pathname === `/assistants/${assistant.id}`
              
              return (
                <div
                  key={assistant.id}
                  className={`mx-2 px-3 py-2 cursor-pointer rounded-xl transition-colors ${
                    isActive
                      ? "bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300" 
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                  onClick={() => handleAssistantSelect(assistant.id)}
                >
                  <div className="font-bold text-base">{assistant.name}</div>
                  <div className="text-xs text-gray-500">
                    {assistant.firstMessage ? assistant.firstMessage.substring(0, 30) + (assistant.firstMessage.length > 30 ? '...' : '') : 'No description'}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1">
        {children}
      </div>
      
      <CreateAssistantModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateAssistant={handleCreateAssistant}
      />
    </div>
  )
} 