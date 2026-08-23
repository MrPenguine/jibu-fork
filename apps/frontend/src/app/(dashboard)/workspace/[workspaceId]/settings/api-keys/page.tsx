"use client";

import * as React from "react";
import { KeyRound, Copy, RotateCw, Trash2, Ban, Eye, EyeOff } from "lucide-react";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@libs/shadcn-ui/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@libs/shadcn-ui/components/ui/alert-dialog";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import { fetchAPI } from "../../../../../../utils/api";

interface ApiKey {
  id: string;
  name: string;
  start?: string | null;
  prefix?: string | null;
  scopes: string[];
  enabled: boolean;
  expiresAt?: string | null;
  createdAt: string;
  lastRequest?: string | null;
}

type KeyAction = "rotate" | "revoke" | "delete";

export default function ApiKeysPage() {
  const [keys, setKeys] = React.useState<ApiKey[]>([]);
  const [name, setName] = React.useState("");
  const [expiresIn, setExpiresIn] = React.useState("");
  const [newKey, setNewKey] = React.useState<string | null>(null);
  const [showKey, setShowKey] = React.useState(true);
  const [revealId, setRevealId] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [pendingAction, setPendingAction] = React.useState<{ id: string; action: KeyAction } | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadKeys = React.useCallback(async () => {
    try {
      setKeys(await fetchAPI("/api-keys"));
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to load API keys.", variant: "destructive" });
    }
  }, []);

  React.useEffect(() => { loadKeys(); }, [loadKeys]);

  const createKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const result = await fetchAPI("/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          ...(expiresIn ? { expiresIn: Number(expiresIn) * 86400 } : {}),
        }),
      });
      setNewKey(result.apiKey);
      setShowKey(true);
      setName("");
      setExpiresIn("");
      await loadKeys();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create API key.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    toast({ title: "Copied", description: "The API key was copied to your clipboard." });
  };

  const revealKey = async () => {
    if (!revealId) return;
    setLoading(true);
    try {
      const result = await fetchAPI(`/api-keys/${revealId}/reveal`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setNewKey(result.apiKey);
      setShowKey(true);
      setRevealId(null);
      setPassword("");
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to reveal API key.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (id: string, action: KeyAction) => {
    try {
      const endpoint = action === "delete" ? `/api-keys/${id}` : `/api-keys/${id}/${action}`;
      const result = await fetchAPI(endpoint, { method: action === "delete" ? "DELETE" : "POST" });
      if (action === "rotate") {
        setNewKey(result.apiKey);
        setShowKey(true);
      }
      toast({ title: "Success", description: `API key ${action === "delete" ? "deleted" : `${action}d`} successfully.` });
      await loadKeys();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : `Failed to ${action} API key.`, variant: "destructive" });
    }
  };

  return (
    <div className="w-full p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><KeyRound className="h-7 w-7" /> API Keys</h1>
          <p className="text-muted-foreground">Manage keys for workspace integrations.</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Create API key</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createKey} className="flex flex-col gap-3 md:flex-row">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Key name" required />
              <Input value={expiresIn} onChange={(event) => setExpiresIn(event.target.value)} type="number" min="1" placeholder="Expiry (days, optional)" />
              <Button type="submit" disabled={loading}>Create key</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Workspace keys</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {keys.length === 0 && <p className="text-sm text-muted-foreground">No API keys yet.</p>}
              {keys.map((key) => (
                <div key={key.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium">{key.name}</p>
                    <p className="text-sm text-muted-foreground">{key.start || key.prefix || "—"} · {key.scopes.join(", ") || "No scopes"} · {key.enabled ? "Enabled" : "Revoked"}</p>
                    <p className="text-xs text-muted-foreground">Created {new Date(key.createdAt).toLocaleDateString()} · Last used {key.lastRequest ? new Date(key.lastRequest).toLocaleDateString() : "Never"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRevealId(key.id)} disabled={!key.enabled}>Reveal</Button>
                    <Button variant="outline" size="icon" onClick={() => setPendingAction({ id: key.id, action: "rotate" })} disabled={!key.enabled} aria-label="Rotate key"><RotateCw className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => setPendingAction({ id: key.id, action: "revoke" })} disabled={!key.enabled} aria-label="Revoke key"><Ban className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => setPendingAction({ id: key.id, action: "delete" })} aria-label="Delete key"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={Boolean(newKey)} onOpenChange={(open) => { if (!open) { setNewKey(null); setShowKey(true); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save your API key</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This plaintext is shown only once. Store it securely before closing.</p>
          <div className="flex gap-2">
            <Input value={newKey || ""} readOnly type={showKey ? "text" : "password"} className="font-mono select-all" />
            <Button variant="outline" size="icon" onClick={() => setShowKey((visible) => !visible)} aria-label={showKey ? "Hide API key" : "Show API key"}>
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={copyKey} aria-label="Copy API key"><Copy className="h-4 w-4" /></Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === "rotate" ? "Rotate API key?" : pendingAction?.action === "revoke" ? "Revoke API key?" : "Delete API key?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === "rotate"
                ? "The current key will stop working and a replacement will be created."
                : pendingAction?.action === "revoke"
                  ? "This key will stop working immediately."
                  : "This action cannot be undone and the key will stop working immediately."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingAction) void runAction(pendingAction.id, pendingAction.action);
              setPendingAction(null);
            }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={Boolean(revealId)} onOpenChange={(open) => { if (!open) { setRevealId(null); setPassword(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reveal API key</DialogTitle></DialogHeader>
          <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Account password" />
          <DialogFooter><Button onClick={revealKey} disabled={loading || !password}>Reveal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
