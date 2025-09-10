"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Input } from '@libs/shadcn-ui/components/ui/input';
import { Label } from '@libs/shadcn-ui/components/ui/label';
import { Textarea } from '@libs/shadcn-ui/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@libs/shadcn-ui/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter as DialogFooterUI, DialogHeader, DialogTitle } from '@libs/shadcn-ui/components/ui/dialog';
import { Skeleton } from '@libs/shadcn-ui/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@libs/shadcn-ui/components/ui/radio-group';
import { Switch } from '@libs/shadcn-ui/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@libs/shadcn-ui/components/ui/tooltip';
import { toast } from '@libs/shadcn-ui/components/ui/use-toast';
import { Copy, Info } from 'lucide-react';
import { agentApiClient } from '../../../../../../utils/AgentApi';

export default function AgentGeneralSettingsPage({ params }: { params: Promise<{ agentId: string }> }) {
  // Unwrap the params Promise per Next.js guidance
  const { agentId } = React.use(params);
  const [isLoading, setIsLoading] = useState(true);
  const [agent, setAgent] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const router = useRouter();

  // Local UI preferences (frontend-only)
  type NavigationPref = 'trackpad' | 'mouse';
  type ZoomPref = 'natural' | 'inverse';
  type ConnectorPref = 'elbow' | 'curved';

  const storageKeys = useMemo(() => ({
    prefs: agentId ? `agent:${agentId}:canvas_prefs` : undefined,
    priv: agentId ? `agent:${agentId}:private` : undefined,
  }), [agentId]);

  const [navigationPref, setNavigationPref] = useState<NavigationPref>('trackpad');
  const [zoomPref, setZoomPref] = useState<ZoomPref>('natural');
  const [connectorPref, setConnectorPref] = useState<ConnectorPref>('elbow');
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    const fetchAgentDetails = async () => {
      if (!agentId) {
        router.push('/workspace');
        return;
      }

      try {
        setIsLoading(true);
        const agentData = await agentApiClient.getAgentDefinition(agentId);
        setAgent(agentData);
        setName(agentData.name || '');
        setDescription(agentData.description || '');
      } catch (error) {
        console.error("Failed to fetch agent details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgentDetails();
  }, [agentId, router]);

  // Load locally-stored preferences once agentId is available
  useEffect(() => {
    if (!storageKeys.prefs || !storageKeys.priv) return;
    try {
      const raw = localStorage.getItem(storageKeys.prefs);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          navigation?: NavigationPref;
          zoom?: ZoomPref;
          connectors?: ConnectorPref;
        };
        if (parsed.navigation) setNavigationPref(parsed.navigation);
        if (parsed.zoom) setZoomPref(parsed.zoom);
        if (parsed.connectors) setConnectorPref(parsed.connectors);
      }
      const privRaw = localStorage.getItem(storageKeys.priv);
      if (privRaw != null) setIsPrivate(privRaw === 'true');
    } catch (e) {
      console.warn('Failed to load local preferences', e);
    }
  }, [storageKeys.prefs, storageKeys.priv]);

  // Persist preferences
  useEffect(() => {
    if (!storageKeys.prefs) return;
    try {
      localStorage.setItem(storageKeys.prefs, JSON.stringify({
        navigation: navigationPref,
        zoom: zoomPref,
        connectors: connectorPref,
      }));
    } catch {}
  }, [navigationPref, zoomPref, connectorPref, storageKeys.prefs]);

  useEffect(() => {
    if (!storageKeys.priv) return;
    try {
      localStorage.setItem(storageKeys.priv, String(isPrivate));
    } catch {}
  }, [isPrivate, storageKeys.priv]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Validation error',
        description: 'Agent name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const updatedAgentData = {
        ...agent,
        name,
        description,
      };
      // Remove fields that should not be sent on update
      delete (updatedAgentData as any).createdAt;
      delete (updatedAgentData as any).updatedAt;
      delete (updatedAgentData as any).id;

      await agentApiClient.updateAgentDefinition(agentId, updatedAgentData);
      toast({ title: 'Settings saved', description: "Agent settings updated successfully." });
    } catch (error) {
      console.error("Failed to update agent settings:", error);
      toast({ title: 'Error', description: 'Failed to update agent settings. Please try again.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full px-6 pb-6 pt-0">
        <Skeleton className="h-10 w-1/3" />
        <div className="mt-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 pb-6 pt-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">General</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Info</CardTitle>
          <CardDescription>Update your agent's basic information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Agent name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Describe what this agent does"
              rows={4}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>

      {/* Metadata */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>Internal identifiers for debugging and support</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <Label htmlFor="agent-id">Project ID</Label>
                <div className="relative">
                  <Input id="agent-id" value={agent?.id || agentId} readOnly />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => {
                      navigator.clipboard.writeText(String(agent?.id || agentId));
                      toast({ title: 'Copied', description: 'Project ID copied to clipboard.' });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="version-id">Version ID</Label>
                <div className="relative">
                  <Input id="version-id" value={agent?.versionId || agent?.version?.id || '—'} readOnly />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => {
                      const v = String(agent?.versionId || agent?.version?.id || '');
                      if (!v) return;
                      navigator.clipboard.writeText(v);
                      toast({ title: 'Copied', description: 'Version ID copied to clipboard.' });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Canvas preferences */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Canvas preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="font-medium">Navigation</div>
              </div>
              <RadioGroup
                className="grid grid-cols-2 gap-2"
                value={navigationPref}
                onValueChange={(v: NavigationPref) => setNavigationPref(v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="nav-trackpad" value="trackpad" />
                  <Label htmlFor="nav-trackpad">Trackpad</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="nav-mouse" value="mouse" />
                  <Label htmlFor="nav-mouse">Mouse</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="font-medium">Zoom direction</div>
              </div>
              <RadioGroup
                className="grid grid-cols-2 gap-2"
                value={zoomPref}
                onValueChange={(v: ZoomPref) => setZoomPref(v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="zoom-natural" value="natural" />
                  <Label htmlFor="zoom-natural">Natural</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="zoom-inverse" value="inverse" />
                  <Label htmlFor="zoom-inverse">Inverse</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="font-medium">Connectors</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Choose how nodes are visually connected on the canvas.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <RadioGroup
                className="grid grid-cols-2 gap-2"
                value={connectorPref}
                onValueChange={(v: ConnectorPref) => setConnectorPref(v)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="conn-elbow" value="elbow" />
                  <Label htmlFor="conn-elbow">Elbow</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="conn-curved" value="curved" />
                  <Label htmlFor="conn-curved">Curved</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <div className="mt-6">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-medium">Private agent</div>
                <p className="text-sm text-muted-foreground max-w-[60ch]">
                  When ON, your agent is not accessible without an API key. The website widget and shareable prototype links will be disabled. (UI only)
                </p>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-medium">Delete agent</div>
                <p className="text-sm text-muted-foreground">Permanently delete this agent and all its content.</p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete agent
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={(o) => {
        setDeleteOpen(o);
        if (!o) setConfirmName('');
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              Your project will be permanently deleted with no chance of recovery. Type <span className="font-medium">{agent?.name || 'this agent'}</span> to the input below and confirm.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Input
              placeholder="Enter agent name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
          </div>
          <DialogFooterUI className="mt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!agent?.name || confirmName !== agent?.name}
              onClick={async () => {
                try {
                  await agentApiClient.deleteAgentDefinition(agentId);
                  setDeleteOpen(false);
                  router.push('/workspace');
                } catch (err) {
                  console.error('Failed to delete agent:', err);
                  toast({ title: 'Error', description: 'Failed to delete agent. Please try again.', variant: 'destructive' });
                } finally {
                  setConfirmName('');
                }
              }}
            >
              Delete forever
            </Button>
          </DialogFooterUI>
        </DialogContent>
      </Dialog>
    </div>
  );
}
