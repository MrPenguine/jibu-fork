"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useWorkspace } from '../../../../../apps/frontend/src/utils/workspaceContext';
import { useRouter } from 'next/navigation';
import { toast } from "../ui/use-toast";

export default function DeleteWorkspace() {
  const { activeWorkspace, deleteWorkspace } = useWorkspace();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!activeWorkspace) return;
    
    // Role-based access control - only owners can delete workspaces
    if (activeWorkspace.role !== 'owner') {
      toast({
        title: "Permission Denied",
        description: "Only workspace owners can delete workspaces.",
        variant: "destructive",
      });
      return;
    }
    
    if (confirmText !== activeWorkspace.name) {
      toast({
        title: "Error",
        description: "Please type the workspace name correctly to confirm deletion.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsDeleting(true);
      
      // Call API to delete the workspace
      await deleteWorkspace(activeWorkspace.id);
      
      // Show success message
      toast({
        title: "Workspace deleted",
        description: "Your workspace has been successfully deleted.",
      });
      
      // Redirect to dashboard or workspaces list
      router.push('/workspaces');
      
    } catch (error) {
      console.error("Error deleting workspace:", error);
      toast({
        title: "Error",
        description: "Failed to delete workspace. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!activeWorkspace) {
    return null;
  }
  
  // If user is not an owner, show permission denied
  if (activeWorkspace.role !== 'owner') {
    return (
      <div className="flex items-center gap-3 text-destructive">
        <ShieldAlert className="h-8 w-8" />
        <div>
          <h3 className="font-semibold">Permission Denied</h3>
          <p>Your role: {activeWorkspace.role}. Required role: owner</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        To confirm, please type your workspace name: <span className="font-semibold">{activeWorkspace.name}</span>
      </p>
      
      <div className="space-y-2">
        <Label htmlFor="confirm" className="sr-only">Confirm workspace name</Label>
        <Input 
          id="confirm" 
          value={confirmText} 
          onChange={(e) => setConfirmText(e.target.value)} 
          placeholder="Enter workspace name"
        />
      </div>
      
      <Button 
        variant="destructive" 
        disabled={confirmText !== activeWorkspace.name || isDeleting}
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
            Delete Workspace
          </>
        )}
      </Button>
    </div>
  );
} 
