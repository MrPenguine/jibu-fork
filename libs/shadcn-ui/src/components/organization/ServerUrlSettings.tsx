"use client";

import { useState } from "react";
import { Link, Info, PlusCircle, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useOrganization } from '../../../../../apps/frontend/src/utils/organizationContext';
import { toast } from "../ui/use-toast";

interface HeaderRow {
  name: string;
  value: string;
  id: string;
}

export default function ServerUrlSettings() {
  const { activeOrganization, updateOrganization } = useOrganization();
  const [isSaving, setIsSaving] = useState(false);
  
  // Form states
  const [serverUrl, setServerUrl] = useState(activeOrganization?.settings?.serverUrl || "");
  const [timeoutSeconds, setTimeoutSeconds] = useState(
    activeOrganization?.settings?.timeoutSeconds?.toString() || "20"
  );
  const [headers, setHeaders] = useState<HeaderRow[]>(
    activeOrganization?.settings?.headers?.map((header: any) => ({
      ...header,
      id: crypto.randomUUID()
    })) || []
  );

  const addRow = () => {
    const newRow = {
      name: "",
      value: "",
      id: crypto.randomUUID()
    };
    setHeaders([...headers, newRow]);
  };

  const updateHeader = (id: string, field: "name" | "value", value: string) => {
    setHeaders(headers.map(header => 
      header.id === id ? { ...header, [field]: value } : header
    ));
  };

  const removeHeader = (id: string) => {
    setHeaders(headers.filter(header => header.id !== id));
  };

  const clearAll = () => {
    setHeaders([]);
  };

  const saveSettings = async () => {
    if (!activeOrganization) return;
    
    try {
      setIsSaving(true);
      
      // Prepare data for update
      const updateData = {
        settings: {
          ...activeOrganization.settings,
          serverUrl,
          timeoutSeconds: parseInt(timeoutSeconds),
          headers: headers.map(({ name, value }) => ({ name, value })) // Remove id field
        }
      };
      
      // Call API to update
      await updateOrganization(activeOrganization.id, updateData);
      
      // Show success message
      toast({
        title: "Server settings saved",
        description: "Your server URL settings have been updated successfully.",
      });
    } catch (error) {
      console.error("Error saving server settings:", error);
      toast({
        title: "Error",
        description: "Failed to save server settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Server URL</h2>
        <p className="text-muted-foreground">The URL of your Vapi server.</p>
      </div>
      
      <div className="p-6 bg-card rounded-lg border space-y-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="serverUrl" className="flex items-center">
                <Link className="h-4 w-4 mr-2" />
                Server URL
              </Label>
            </div>
            <Input 
              id="serverUrl" 
              value={serverUrl} 
              onChange={(e) => setServerUrl(e.target.value)} 
              placeholder="No Server URL"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="timeoutSeconds">
                <Info className="h-4 w-4 mr-2" />
                Timeout Seconds
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This is the timeout in seconds for the request to your server. Must be between 1 and 120 seconds.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              This is the timeout in seconds for the request to your server. Must be between 1 and 120 seconds.
            </p>
            <Input 
              id="timeoutSeconds" 
              value={timeoutSeconds} 
              onChange={(e) => setTimeoutSeconds(e.target.value)} 
              min="1"
              max="120"
              type="number"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>
                <Label htmlFor="headers">Headers</Label>
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>These are the custom headers to include in the request sent to your server. Each key-value pair represents a header name and its value.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              These are the custom headers to include in the request sent to your server. Each key-value pair represents a header name and its value.
            </p>
            
            {headers.length > 0 && (
              <div className="space-y-2 mb-4">
                {headers.map((header) => (
                  <div key={header.id} className="flex gap-2">
                    <Input 
                      value={header.name} 
                      onChange={(e) => updateHeader(header.id, "name", e.target.value)} 
                      placeholder="Header Name"
                      className="flex-1"
                    />
                    <Input 
                      value={header.value} 
                      onChange={(e) => updateHeader(header.id, "value", e.target.value)} 
                      placeholder="Header Value"
                      className="flex-1"
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeHeader(header.id)}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <Button 
              variant="outline" 
              onClick={addRow}
              className="flex items-center"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Row
            </Button>
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={clearAll}
          >
            Clear
          </Button>
          <Button 
            onClick={saveSettings}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
} 