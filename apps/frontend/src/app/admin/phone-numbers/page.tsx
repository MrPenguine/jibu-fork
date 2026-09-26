"use client";

import * as React from "react";
import { Loader2, Search, Undo2, RefreshCw, RotateCw } from "lucide-react";
import { Badge } from "@libs/shadcn-ui/components/ui/badge";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Card } from "@libs/shadcn-ui/components/ui/card";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@libs/shadcn-ui/components/ui/select";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import { fetchAPI } from "../../../utils/api";

const PROVIDER_LABELS: Record<string, string> = {
  twilio: "Twilio",
  africastalking: "Africa's Talking",
  safaricom_sip: "Safaricom SIP",
  airtel_sip: "Airtel SIP",
};

const MANUAL_PROVIDERS = ["africastalking", "safaricom_sip", "airtel_sip"];

interface AdminPhoneNumber {
  id: string;
  workspaceId: string | null;
  workspace: { id: string; name: string } | null;
  number: string;
  country: string;
  provider: string;
  capabilities: string[];
  status: string;
  agent: { id: string; name: string } | null;
  claimedAt: string | null;
  releasedAt: string | null;
}

interface AvailableTwilioNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  isoCountry: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  provisioning_partial: "bg-amber-100 text-amber-800",
  releasing: "bg-destructive/10 text-destructive",
  released: "bg-muted text-muted-foreground",
};

export default function AdminPhoneNumbersPage() {
  const [inventory, setInventory] = React.useState<AdminPhoneNumber[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [searchCountry, setSearchCountry] = React.useState("US");
  const [searchAreaCode, setSearchAreaCode] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<AvailableTwilioNumber[]>([]);
  const [searching, setSearching] = React.useState(false);

  const [manualNumber, setManualNumber] = React.useState("");
  const [manualCountry, setManualCountry] = React.useState("");
  const [manualProvider, setManualProvider] = React.useState<string>(MANUAL_PROVIDERS[0]);
  const [manualAdding, setManualAdding] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);

  const loadInventory = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAPI("/admin/phone-numbers");
      setInventory(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast({ title: "Could not load inventory", description: error?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const handleSearch = async () => {
    if (!searchCountry.trim()) return;
    try {
      setSearching(true);
      const params = new URLSearchParams({ country: searchCountry.trim().toUpperCase() });
      if (searchAreaCode.trim()) params.set("areaCode", searchAreaCode.trim());
      const data = await fetchAPI(`/admin/phone-numbers/search?${params}`);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast({ title: "Twilio search failed", description: error?.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualNumber.trim() || !manualCountry.trim()) {
      toast({ title: "Number and country are required", variant: "destructive" });
      return;
    }
    try {
      setManualAdding(true);
      await fetchAPI("/admin/phone-numbers/manual-add", {
        method: "POST",
        body: JSON.stringify({
          number: manualNumber.trim(),
          country: manualCountry.trim().toUpperCase(),
          provider: manualProvider,
          capabilities: ["voice"],
        }),
      });
      toast({ title: "Number added to pool", description: manualNumber.trim() });
      setManualNumber("");
      setManualCountry("");
      await loadInventory();
    } catch (error: any) {
      toast({ title: "Could not add number", description: error?.message, variant: "destructive" });
    } finally {
      setManualAdding(false);
    }
  };

  const handleSyncTwilio = async () => {
    try {
      setSyncing(true);
      const result = await fetchAPI("/admin/phone-numbers/sync-twilio", { method: "POST" });
      if (result?.skipped) {
        toast({ title: "Twilio isn't connected yet", description: "Add credentials above first.", variant: "destructive" });
      } else {
        toast({
          title: result?.added?.length ? `Added ${result.added.length} number(s) from Twilio` : "Already in sync",
          description: result?.added?.length ? result.added.join(", ") : "No new numbers found on the Twilio account.",
        });
      }
      await loadInventory();
    } catch (error: any) {
      toast({ title: "Sync failed", description: error?.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleForceRelease = async (n: AdminPhoneNumber) => {
    if (!window.confirm(`Force-release ${n.number} from ${n.workspace?.name || "its workspace"}?`)) return;
    try {
      setBusyId(n.id);
      await fetchAPI(`/admin/phone-numbers/${n.id}/force-release`, { method: "POST" });
      toast({ title: "Number released back to the pool" });
      await loadInventory();
    } catch (error: any) {
      toast({ title: "Could not release number", description: error?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleRetryProvisioning = async (n: AdminPhoneNumber) => {
    try {
      setBusyId(n.id);
      await fetchAPI(`/admin/phone-numbers/${n.id}/retry-provisioning`, { method: "POST" });
      toast({ title: "Provisioning retried" });
      await loadInventory();
    } catch (error: any) {
      toast({ title: "Retry failed", description: error?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Phone Number Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform-owned pool across all workspaces. Twilio numbers are purchased on demand by workspaces at claim time;
            manual carriers (Africa&apos;s Talking, Safaricom SIP, Airtel SIP) are onboarded here after their offline KYC process.
          </p>
        </div>
        <Button variant="outline" onClick={handleSyncTwilio} disabled={syncing} className="shrink-0">
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
          Sync from Twilio
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-4">
        Also runs automatically every 10 minutes — picks up numbers bought directly in the Twilio console, or ones a
        purchase billed successfully but that failed to save here, without any manual re-entry.
      </p>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Search className="h-4 w-4" /> Search Twilio (platform account)</h2>
        <div className="flex gap-2 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Country (ISO)</label>
            <Input className="w-24" value={searchCountry} onChange={(e) => setSearchCountry(e.target.value)} placeholder="US" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Area code (optional)</label>
            <Input className="w-32" value={searchAreaCode} onChange={(e) => setSearchAreaCode(e.target.value)} placeholder="415" />
          </div>
          <Button onClick={handleSearch} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1 pt-1">
            {searchResults.map((n) => (
              <div key={n.phoneNumber} className="flex justify-between border-b py-1">
                <span className="font-medium text-foreground">{n.phoneNumber}</span>
                <span>{[n.locality, n.region].filter(Boolean).join(", ") || n.isoCountry}</span>
              </div>
            ))}
            <p className="pt-1">Purchasing happens when a workspace claims one — this is search only, not a buy action here.</p>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Manually add a carrier number</h2>
        <p className="text-xs text-muted-foreground">
          For Africa&apos;s Talking / Safaricom SIP / Airtel SIP — no self-serve API exists, so register the number here after completing their manual onboarding (KYC, IP whitelisting).
        </p>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Number (E.164)</label>
            <Input className="w-44" value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} placeholder="+254700123456" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Country (ISO)</label>
            <Input className="w-24" value={manualCountry} onChange={(e) => setManualCountry(e.target.value)} placeholder="KE" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Provider</label>
            <Select value={manualProvider} onValueChange={setManualProvider}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MANUAL_PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleManualAdd} disabled={manualAdding}>
            {manualAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add to pool
          </Button>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b bg-background">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-card">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Loading inventory…
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">No phone numbers yet.</td>
                </tr>
              ) : (
                inventory.map((n) => {
                  const busy = busyId === n.id;
                  return (
                    <tr key={n.id} className="hover:bg-background">
                      <td className="px-6 py-4 font-medium text-foreground">{n.number}</td>
                      <td className="px-6 py-4 text-sm">{PROVIDER_LABELS[n.provider] || n.provider}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {n.workspace ? n.workspace.name : <span className="italic">Unowned (pool)</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{n.agent?.name || "—"}</td>
                      <td className="px-6 py-4">
                        <Badge className={STATUS_STYLE[n.status] || "bg-muted"}>{n.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {n.status === "provisioning_partial" && (
                            <Button variant="outline" size="sm" onClick={() => handleRetryProvisioning(n)} disabled={busy}>
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                          )}
                          {n.workspace && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleForceRelease(n)}
                              disabled={busy}
                            >
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                              <span className="ml-1">Force release</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
