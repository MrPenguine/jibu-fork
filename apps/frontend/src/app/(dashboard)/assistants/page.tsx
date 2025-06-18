"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
import { Assistant } from "../../../utils/AssistantsApi"
import { useOrganization } from "../../../utils/organizationContext"
import { fetchAPI } from "../../../utils/api"

export default function AssistantsPage() {
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { activeOrganization, loading: orgLoading } = useOrganization()

  useEffect(() => {
    const fetchAssistants = async () => {
      if (!activeOrganization || orgLoading) {
        // Not ready to fetch yet, wait for organization context
        return;
      }
      
      try {
        setLoading(true)
        console.log(`[AssistantsPage] Fetching assistants for organization: ${activeOrganization.id} (${activeOrganization.name})`);
        
        // Use fetchAPI directly with the organization ID from context, just like in MembersList
        const data = await fetchAPI(`/assistants?organizationId=${activeOrganization.id}`);
        console.log(`[AssistantsPage] Successfully loaded ${data.length} assistants`);
        
        setAssistants(data);
        setError(null);
      } catch (err: any) {
        console.error("[AssistantsPage] Error fetching assistants:", err)
        
        // Handle specific error cases
        if (err.message && err.message.includes('No active organization found')) {
          setError("Please select an organization to view assistants.")
        } else if (err.message && err.message.includes('You do not have access to this organization')) {
          setError("You don't have access to the selected organization. Please choose a different one.")
        } else if (err.message && (
          err.message.includes('404') || 
          err.message.includes('not found') ||
          err.message.toLowerCase().includes('no assistants')
        )) {
          // This is normal for a new organization - treat as empty
          setAssistants([])
          setError(null)
        } else {
          // Generic error for other cases
          setError("Failed to load assistants. Please try again.")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchAssistants()
  }, [activeOrganization, orgLoading])

  const handleCreateAssistantClick = () => {
    // Find and trigger the create assistant button in the layout
    const createButton = document.querySelector("[data-create-assistant-button]") as HTMLButtonElement
    if (createButton) {
      createButton.click()
    }
  }

  // Show loading state
  if (loading || orgLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)]">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h3 className="text-lg font-medium">Loading assistants...</h3>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)]">
        <div className="bg-red-50 p-6 rounded-xl text-center max-w-md">
          <h3 className="text-lg font-medium text-red-800 mb-2">Something went wrong</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button 
            onClick={() => window.location.reload()}
            className="rounded-xl"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  // Show empty state if no assistants
  if (assistants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)]">
        <div className="bg-gray-50 dark:bg-gray-900 p-10 rounded-xl text-center max-w-md">
          <div className="bg-primary/10 p-4 rounded-full inline-flex mx-auto mb-4">
            <Plus className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-medium mb-2">No assistants yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Create your first assistant to start building conversations.
          </p>
          <Button 
            onClick={handleCreateAssistantClick}
            className="rounded-xl flex items-center gap-2"
            size="lg"
          >
            <Plus className="h-4 w-4" /> Create Assistant
          </Button>
        </div>
      </div>
    )
  }

  // Show list of assistants
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assistants.map((assistant) => (
          <div 
            key={assistant.id}
            onClick={() => router.push(`/assistants/${assistant.id}`)}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-shadow"
          >
            <h3 className="font-medium text-lg mb-2">{assistant.name}</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">
              {assistant.firstMessage || "No description provided"}
            </p>
            <div className="flex items-center justify-between">
              <span className={`text-xs px-2 py-1 rounded-full ${
                assistant.hipaaEnabled
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
              }`}>
                {assistant.hipaaEnabled ? "HIPAA Enabled" : "Standard"}
              </span>
              <span className="text-xs text-gray-500">
                Created {new Date(assistant.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
