"use client"

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { fetchAPI } from '../../../../../apps/frontend/src/utils/api'
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext'

interface CreateOrganizationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateOrganizationModal({ 
  open, 
  onOpenChange,
  onSuccess 
}: CreateOrganizationModalProps) {
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { refreshOrganizations } = useOrganization()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Organization name is required')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      
      await fetchAPI('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() })
      })
      
      setName('')
      onOpenChange(false)
      
      // Refresh organizations in context
      refreshOrganizations()
      
      // Call additional success callback if provided
      if (onSuccess) {
        onSuccess()
      }
      
      // No need to refresh the page anymore as context will handle it
    } catch (err) {
      console.error('Error creating organization:', err)
      setError(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Add a new organization to your account. You'll be assigned as the owner.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-2 rounded-md">
                {error}
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                placeholder="Acme Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Organization'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 