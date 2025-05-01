"use client";

import { useState } from "react";
import { Building2, Copy, Info, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Switch } from "../ui/switch";
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext';
import { toast } from "../ui/use-toast";

export default function OrganizationSettings() {
  const { activeOrganization, loading, updateOrganization } = useOrganization();
  const [isSaving, setIsSaving] = useState(false);
  
  // Form states
  const [organizationName, setOrganizationName] = useState(activeOrganization?.name || "");
  const [organizationEmail, setOrganizationEmail] = useState(activeOrganization?.email || "");
  const [callConcurrencyLimit, setCallConcurrencyLimit] = useState(
    activeOrganization?.settings?.callConcurrencyLimit?.toString() || "10"
  );
  const [hipaaEnabled, setHipaaEnabled] = useState(activeOrganization?.settings?.hipaaEnabled || false);
  const [pciEnabled, setPciEnabled] = useState(activeOrganization?.settings?.pciEnabled || false);
  const [channel, setChannel] = useState(activeOrganization?.settings?.channel || "daily");
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "The ID has been copied to your clipboard.",
    });
  };

  const handleSave = async () => {
    if (!activeOrganization) return;
    
    try {
      setIsSaving(true);
      
      // Prepare data for update
      const updateData = {
        name: organizationName,
        email: organizationEmail,
        settings: {
          channel,
          callConcurrencyLimit: parseInt(callConcurrencyLimit),
          hipaaEnabled,
          pciEnabled,
        }
      };
      
      // Call API to update
      await updateOrganization(activeOrganization.id, updateData);
      
      // Show success message
      toast({
        title: "Settings saved",
        description: "Your organization settings have been updated successfully.",
      });
    } catch (error) {
      console.error("Error saving organization settings:", error);
      toast({
        title: "Error",
        description: "Failed to save organization settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !activeOrganization) {
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
          <Label htmlFor="name">Organization Name</Label>
          <Input 
            id="name" 
            value={organizationName} 
            onChange={(e) => setOrganizationName(e.target.value)} 
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Organization Email</Label>
          <Input 
            id="email" 
            value={organizationEmail} 
            onChange={(e) => setOrganizationEmail(e.target.value)} 
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="orgId" className="flex items-center">
            Organization ID
          </Label>
          <div className="relative">
            <Input 
              id="orgId" 
              value={activeOrganization?.id || ""} 
              readOnly 
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-2 top-1/2 transform -translate-y-1/2" 
              onClick={() => copyToClipboard(activeOrganization?.id || "")}
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
          <Select value={channel} onValueChange={setChannel}>
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
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
} 