"use client";

import { useState } from "react";
import { Building2, Copy, Info, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Switch } from "../ui/switch";
import { useWorkspace } from '../../../../../apps/frontend/src/utils/workspaceContext';
import { toast } from "../ui/use-toast";

export interface WorkspaceSettingsProps {
  readOnly?: boolean;
}

export default function WorkspaceSettings({ readOnly = false }: WorkspaceSettingsProps) {
  const { activeWorkspace, loading, updateWorkspace } = useWorkspace();
  const [isSaving, setIsSaving] = useState(false);
  
  // Form states
  const [workspaceName, setWorkspaceName] = useState(activeWorkspace?.name || "");
  const [workspaceEmail, setWorkspaceEmail] = useState(activeWorkspace?.email || "");
  const [callConcurrencyLimit, setCallConcurrencyLimit] = useState(
    activeWorkspace?.settings?.callConcurrencyLimit?.toString() || "10"
  );
  const [hipaaEnabled, setHipaaEnabled] = useState(activeWorkspace?.settings?.hipaaEnabled || false);
  const [pciEnabled, setPciEnabled] = useState(activeWorkspace?.settings?.pciEnabled || false);
  const [channel, setChannel] = useState(activeWorkspace?.settings?.channel || "daily");
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "The ID has been copied to your clipboard.",
    });
  };

  const handleSave = async () => {
    if (!activeWorkspace) return;
    
    try {
      setIsSaving(true);
      
      // Prepare data for update
      const updateData = {
        name: workspaceName,
        email: workspaceEmail,
        settings: {
          channel,
          callConcurrencyLimit: parseInt(callConcurrencyLimit),
          hipaaEnabled,
          pciEnabled,
        }
      };
      
      // Call API to update
      await updateWorkspace(activeWorkspace.id, updateData);
      
      // Show success message
      toast({
        title: "Settings saved",
        description: "Your workspace settings have been updated successfully.",
      });
    } catch (error) {
      console.error("Error saving workspace settings:", error);
      toast({
        title: "Error",
        description: "Failed to save workspace settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !activeWorkspace) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-muted rounded w-full"></div>
        <div className="h-10 bg-muted rounded w-full"></div>
        <div className="h-10 bg-muted rounded w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Workspace Name</Label>
          <Input 
            id="name" 
            value={workspaceName} 
            onChange={(e) => setWorkspaceName(e.target.value)} 
            readOnly={readOnly}
            disabled={readOnly}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Workspace Email</Label>
          <Input 
            id="email" 
            value={workspaceEmail} 
            onChange={(e) => setWorkspaceEmail(e.target.value)} 
            readOnly={readOnly}
            disabled={readOnly}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="workspaceId" className="flex items-center">
            Workspace ID
          </Label>
          <div className="relative">
            <Input 
              id="workspaceId" 
              value={activeWorkspace?.id || ""} 
              readOnly 
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-2 top-1/2 transform -translate-y-1/2" 
              onClick={() => copyToClipboard(activeWorkspace?.id || "")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="walletId" className="flex items-center">
            Wallet ID
          </Label>
          <div className="relative">
            <Input 
              id="walletId" 
              value="df107735-fc0b-430c-a308-6080ae56fcf9" 
              readOnly 
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-2 top-1/2 transform -translate-y-1/2" 
              onClick={() => copyToClipboard("df107735-fc0b-430c-a308-6080ae56fcf9")}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="channel">Channel</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select your video channel provider</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select value={channel} onValueChange={setChannel} disabled={readOnly}>
            <SelectTrigger>
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">daily</SelectItem>
              <SelectItem value="zoom">zoom</SelectItem>
              <SelectItem value="teams">teams</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="callConcurrency">Call Concurrency Limit</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum number of concurrent calls</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input 
            id="callConcurrency" 
            value={callConcurrencyLimit} 
            onChange={(e) => setCallConcurrencyLimit(e.target.value)}
            readOnly={readOnly}
            disabled={readOnly}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="hipaa">HIPAA Enabled</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Enabling HIPAA will disable storage of call recordings, logs or transcripts of any future calls.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground">
                Enabling HIPAA will disable storage of call recordings, logs or transcripts of any future calls.
              </p>
            </div>
            <Switch 
              id="hipaa" 
              checked={hipaaEnabled} 
              onCheckedChange={setHipaaEnabled}
              disabled={readOnly}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="pci">PCI Enabled</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Enabling PCI will disable storage of call recordings, logs or transcripts of any future calls.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground">
                Enabling PCI will disable storage of call recordings, logs or transcripts of any future calls.
              </p>
            </div>
            <Switch 
              id="pci" 
              checked={pciEnabled} 
              onCheckedChange={setPciEnabled}
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      {!readOnly && (
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      )}
    </div>
  );
} 
