"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext';
import { useRouter } from 'next/navigation';
import { toast } from "../ui/use-toast";

export default function DeleteOrganization() {
  const { activeOrganization, deleteOrganization } = useOrganization();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!activeOrganization) return;
    
    if (confirmText !== activeOrganization.name) {
      toast({
        title: "Error",
        description: "Please type the organization name correctly to confirm deletion.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsDeleting(true);
      
      // Call API to delete the organization
      await deleteOrganization(activeOrganization.id);
      
      // Show success message
      toast({
        title: "Organization deleted",
        description: "Your organization has been successfully deleted.",
      });
      
      // Redirect to dashboard or organizations list
      router.push('/organizations');
      
    } catch (error) {
      console.error("Error deleting organization:", error);
      toast({
        title: "Error",
        description: "Failed to delete organization. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!activeOrganization) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Delete Organization</h2>
        <p className="text-destructive-foreground/80">
          Permanently remove your organization and all its contents. This action cannot be undone, so please proceed with caution.
        </p>
      </div>
      
      <div className="p-6 bg-card rounded-lg border space-y-4">
        <p className="text-muted-foreground">
          To confirm, please type your organization name: <span className="font-semibold">{activeOrganization.name}</span>
        </p>
        
        <div className="space-y-2">
          <Label htmlFor="confirm" className="sr-only">Confirm organization name</Label>
          <Input 
            id="confirm" 
            value={confirmText} 
            onChange={(e) => setConfirmText(e.target.value)} 
            placeholder="Enter organization name"
          />
        </div>
        
        <Button 
          variant="destructive" 
          disabled={confirmText !== activeOrganization.name || isDeleting}
          onClick={handleDelete}
          className="gap-2"
        >
          {isDeleting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4" />
              Delete Organization
            </>
          )}
        </Button>
      </div>
    </div>
  );
} 