"use client";

import { useState } from "react";
import { Link, Info, PlusCircle, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useWorkspace } from '../../../../../apps/frontend/src/utils/workspaceContext';
import { toast } from "../ui/use-toast";

interface HeaderRow {
  name: string;
  value: string;
  id: string;
}

export interface ServerUrlSettingsProps {
  readOnly?: boolean;
}

export default function ServerUrlSettings({ readOnly = false }: ServerUrlSettingsProps) {
  const { activeWorkspace, updateWorkspace } = useWorkspace();
  const [isSaving, setIsSaving] = useState(false);
  
  // Form states
  const [serverUrl, setServerUrl] = useState(activeWorkspace?.settings?.serverUrl || "");
  const [timeoutSeconds, setTimeoutSeconds] = useState(
    activeWorkspace?.settings?.timeoutSeconds?.toString() || "20"
  );
  const [headers, setHeaders] = useState<HeaderRow[]>(
    activeWorkspace?.settings?.headers?.map((header: any) => ({
      ...header,
      id: crypto.randomUUID()
    })) || []
  );

  const addRow = () => {
    if (readOnly) return;
    const newRow = {
      name: "",
      value: "",
      id: crypto.randomUUID()
    };
    setHeaders([...headers, newRow]);
  };

  const updateHeader = (id: string, field: "name" | "value", value: string) => {
    if (readOnly) return;
    setHeaders(headers.map(header => 
      header.id === id ? { ...header, [field]: value } : header
    ));
  };

  const removeHeader = (id: string) => {
    if (readOnly) return;
    setHeaders(headers.filter(header => header.id !== id));
  };

  const clearAll = () => {
    if (readOnly) return;
    setHeaders([]);
  };

  const saveSettings = async () => {
    if (!activeWorkspace) return;
    
    try {
      setIsSaving(true);
      
      // Prepare data for update
      const updateData = {
        settings: {
          ...activeWorkspace.settings,
          serverUrl,
          timeoutSeconds: parseInt(timeoutSeconds),
          headers: headers.map(({ name, value }) => ({ name, value })) // Remove id field
        }
      };
      
      // Call API to update
      await updateWorkspace(activeWorkspace.id, updateData);
      
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
    <div className="space-y-8">
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Label htmlFor="serverUrl" className="flex items-center">
              <Link className="h-4 w-4 mr-1.5 text-primary" />
              Server URL
            </Label>
          </div>
          <Input 
            id="serverUrl" 
            value={serverUrl} 
            onChange={(e) => setServerUrl(e.target.value)} 
            placeholder="No Server URL"
            className="mt-1 rounded-xl"
            readOnly={readOnly}
            disabled={readOnly}
          />
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Label htmlFor="timeoutSeconds" className="flex items-center">
              <Info className="h-4 w-4 mr-1.5 text-primary" />
              Timeout Seconds
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground hover:text-primary cursor-help transition-colors" />
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
            className="rounded-xl"
            readOnly={readOnly}
            disabled={readOnly}
          />
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Label className="flex items-center">
              <Info className="h-4 w-4 mr-1.5 text-primary" />
              Headers
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground hover:text-primary cursor-help transition-colors" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>These are the custom headers to include in the request sent to your server. Each key-value pair represents a header name and its value.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            These are the custom headers to include in the request sent to your server. Each key-value pair represents a header name and its value.
          </p>
          
          {headers.length > 0 && (
            <div className="space-y-2 mb-3">
              {headers.map((header) => (
                <div key={header.id} className="flex gap-2 items-center">
                  <Input 
                    value={header.name} 
                    onChange={(e) => updateHeader(header.id, "name", e.target.value)}
                    placeholder="Header Name"
                    className="flex-1 rounded-xl"
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                  <Input 
                    value={header.value} 
                    onChange={(e) => updateHeader(header.id, "value", e.target.value)} 
                    placeholder="Header Value"
                    className="flex-1 rounded-xl"
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeHeader(header.id)}
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full p-0 flex items-center justify-center"
                    >
                      ✕
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {!readOnly && (
            <Button 
              variant="outline" 
              onClick={addRow}
              className="flex items-center rounded-xl"
            >
              <PlusCircle className="h-4 w-4 mr-2 text-primary" />
              Add Row
            </Button>
          )}
        </div>
      </div>
      
      {!readOnly && (
        <div className="flex justify-end gap-3 pt-3">
          <Button 
            variant="outline" 
            onClick={clearAll}
            className="rounded-xl border-0"
          >
            Clear
          </Button>
          <Button 
            onClick={saveSettings}
            disabled={isSaving}
            className="gap-2 rounded-xl border-0"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
} 