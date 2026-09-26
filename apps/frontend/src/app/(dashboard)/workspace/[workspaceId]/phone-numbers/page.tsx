"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useWorkspace } from "../../../../../utils/workspaceContext";
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@libs/shadcn-ui/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@libs/shadcn-ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@libs/shadcn-ui/components/ui/table";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import { Phone, Search, Loader2, PhoneCall } from "lucide-react";
import {
  listOwnedNumbers,
  getProviderCatalog,
  browsePool,
  searchTwilio,
  claimPhoneNumber,
  assignAgent,
  releasePhoneNumber,
  type PhoneNumber,
  type ProviderCatalogEntry,
  type AvailableTwilioNumber,
} from "../../../../../utils/phoneNumberApi";
import { agentApiClient } from "../../../../../utils/AgentApi";

const PROVIDER_LABELS: Record<string, string> = {
  twilio: "Twilio",
  africastalking: "Africa's Talking",
  safaricom_sip: "Safaricom SIP",
  airtel_sip: "Airtel SIP",
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  provisioning_partial: "bg-amber-100 text-amber-800",
  releasing: "bg-destructive/10 text-destructive",
  released: "bg-muted text-muted-foreground",
};

export default function PhoneNumbersPage() {
  const routeParams = useParams<{ workspaceId: string }>();
  const workspaceId = (routeParams?.workspaceId as string) || "";
  const { activeWorkspace, loading } = useWorkspace();

  // Numbers this workspace has actually claimed — the only thing the main
  // page shows by default. Buying/browsing happens in the two provider
  // modals below, triggered by their own top-level buttons.
  const [numbers, setNumbers] = React.useState<PhoneNumber[]>([]);
  const [providers, setProviders] = React.useState<ProviderCatalogEntry[]>([]);
  const [agents, setAgents] = React.useState<{ id: string; name: string }[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);

  const [claimingId, setClaimingId] = React.useState<string | null>(null);

  // "Buy from Twilio" modal — live search, since Twilio has a real
  // search-and-purchase API.
  const [buyTwilioOpen, setBuyTwilioOpen] = React.useState(false);
  const [twilioCountry, setTwilioCountry] = React.useState("US");
  const [twilioAreaCode, setTwilioAreaCode] = React.useState("");
  const [twilioResults, setTwilioResults] = React.useState<AvailableTwilioNumber[]>([]);
  const [searchingTwilio, setSearchingTwilio] = React.useState(false);
  const [purchasingNumber, setPurchasingNumber] = React.useState<string | null>(null);

  // "Buy from Africa's Talking" modal — AT has no search/buy API at all
  // (confirmed against their full API reference: no endpoint to search,
  // list, or purchase numbers exists). The only real option is claiming
  // from a small pool a platform admin stocks by hand after acquiring
  // numbers through AT's own dashboard — same one-click claim feel as
  // Twilio, just backed by a manually-curated list instead of a live search.
  const [buyAtOpen, setBuyAtOpen] = React.useState(false);
  const [atPool, setAtPool] = React.useState<PhoneNumber[]>([]);
  const [loadingAtPool, setLoadingAtPool] = React.useState(false);

  const [claimDialogNumber, setClaimDialogNumber] = React.useState<{
    kind: "pool" | "twilio";
    id?: string;
    number: string;
    country?: string;
  } | null>(null);
  const [claimAgentId, setClaimAgentId] = React.useState<string>("");

  const twilioConnected = providers.find((p) => p.provider === "twilio")?.connected;
  const atConnected = providers.find((p) => p.provider === "africastalking")?.connected;

  const refreshOwned = React.useCallback(async () => {
    setLoadingData(true);
    try {
      const [numbersData, providersData, agentsData] = await Promise.all([
        listOwnedNumbers(workspaceId).catch(() => []),
        getProviderCatalog().catch(() => []),
        agentApiClient.getAgentDefinitions(workspaceId).catch(() => []),
      ]);
      setNumbers(numbersData);
      setProviders(providersData);
      setAgents((agentsData as any[]).map((a) => ({ id: a.id, name: a.name })));
    } finally {
      setLoadingData(false);
    }
  }, [workspaceId]);

  React.useEffect(() => {
    if (activeWorkspace) refreshOwned();
  }, [activeWorkspace, refreshOwned]);

  const refreshAtPool = React.useCallback(async () => {
    setLoadingAtPool(true);
    try {
      setAtPool(await browsePool(undefined, "africastalking"));
    } catch (e) {
      toast({ title: "Failed to load Africa's Talking pool", description: String(e), variant: "destructive" });
    } finally {
      setLoadingAtPool(false);
    }
  }, []);

  const openBuyTwilio = () => setBuyTwilioOpen(true);
  const openBuyAt = () => {
    setBuyAtOpen(true);
    refreshAtPool();
  };

  const handleSearchTwilio = async () => {
    setSearchingTwilio(true);
    try {
      setTwilioResults(await searchTwilio(twilioCountry.trim().toUpperCase(), twilioAreaCode.trim() || undefined));
    } catch (e) {
      toast({ title: "Twilio search failed", description: String(e), variant: "destructive" });
    } finally {
      setSearchingTwilio(false);
    }
  };

  const openClaimDialog = (kind: "pool" | "twilio", number: string, id?: string, country?: string) => {
    setClaimAgentId("");
    setClaimDialogNumber({ kind, id, number, country });
  };

  const handleConfirmClaim = async () => {
    if (!claimDialogNumber) return;
    const isTwilio = claimDialogNumber.kind === "twilio";
    if (isTwilio) setPurchasingNumber(claimDialogNumber.number);
    else setClaimingId(claimDialogNumber.id!);
    try {
      await claimPhoneNumber(
        {
          phoneNumberId: isTwilio ? undefined : claimDialogNumber.id,
          twilioNumber: isTwilio ? claimDialogNumber.number : undefined,
          twilioCountry: isTwilio ? claimDialogNumber.country : undefined,
          agentId: claimAgentId || undefined,
        },
        workspaceId,
      );
      toast({ title: "Number claimed", description: claimDialogNumber.number });
      setClaimDialogNumber(null);
      setBuyTwilioOpen(false);
      setBuyAtOpen(false);
      if (isTwilio) setTwilioResults((prev) => prev.filter((n) => n.phoneNumber !== claimDialogNumber.number));
      await Promise.all([refreshOwned(), refreshAtPool()]);
    } catch (e) {
      toast({ title: "Failed to claim number", description: String(e), variant: "destructive" });
    } finally {
      setPurchasingNumber(null);
      setClaimingId(null);
    }
  };

  const handleAssignAgent = async (id: string, agentId: string) => {
    try {
      await assignAgent(id, agentId === "unassigned" ? null : agentId, workspaceId);
      toast({ title: agentId === "unassigned" ? "Number disconnected" : "Number connected to agent" });
      await refreshOwned();
    } catch (e) {
      toast({ title: "Failed to assign agent", description: String(e), variant: "destructive" });
    }
  };

  const handleRelease = async (id: string) => {
    try {
      await releasePhoneNumber(id, workspaceId);
      toast({ title: "Phone number released back to the pool" });
      await Promise.all([refreshOwned(), refreshAtPool()]);
    } catch (e) {
      toast({ title: "Failed to release number", description: String(e), variant: "destructive" });
    }
  };

  if (loading || !activeWorkspace) {
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
    <div className="w-full px-6 pb-6 pt-0 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Phone numbers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {numbers.length} claimed by this workspace · numbers are platform-owned, claimed exclusively, released back to the shared pool
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button onClick={openBuyTwilio} className="text-xs gap-1.5">
            <PhoneCall className="h-3.5 w-3.5" /> Buy from Twilio
          </Button>
          <Button onClick={openBuyAt} variant="outline" className="text-xs gap-1.5">
            <PhoneCall className="h-3.5 w-3.5" /> Buy from Africa's Talking
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>SIP provider</TableHead>
              <TableHead>Assigned agent</TableHead>
              <TableHead>Capabilities</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingData && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            )}
            {!loadingData && numbers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                  No phone numbers claimed yet — use "Buy from Twilio" or "Buy from Africa's Talking" above.
                </TableCell>
              </TableRow>
            )}
            {numbers.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="font-semibold text-sm">{n.number}</TableCell>
                <TableCell className="text-xs">{PROVIDER_LABELS[n.provider] || n.provider}</TableCell>
                <TableCell>
                  <Select
                    value={n.agentId || "unassigned"}
                    onValueChange={(v) => handleAssignAgent(n.id, v)}
                    disabled={n.status === "released"}
                  >
                    <SelectTrigger className="h-8 text-xs w-48">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{n.capabilities.join(", ")}</TableCell>
                <TableCell>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[n.status] || "bg-muted"}`}>
                    {n.status.replace("_", " ")}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive text-xs"
                    disabled={n.status === "released"}
                    onClick={() => handleRelease(n.id)}
                  >
                    Release
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Buy from Twilio — live search modal */}
      <Dialog open={buyTwilioOpen} onOpenChange={setBuyTwilioOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PhoneCall className="h-4 w-4 text-primary" /> Buy from Twilio</DialogTitle>
            <DialogDescription>
              {twilioConnected
                ? "Live search against Twilio's available inventory. Claiming purchases the number into the platform account and assigns it to this workspace immediately — full price, no undo."
                : "Twilio isn't connected yet — a platform admin needs to add Twilio credentials (Settings → Credentials) before numbers can be searched or purchased."}
            </DialogDescription>
          </DialogHeader>
          {twilioConnected && (
            <div className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Country (ISO)</label>
                  <Input className="w-24" value={twilioCountry} onChange={(e) => setTwilioCountry(e.target.value)} placeholder="US" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Area code (optional)</label>
                  <Input className="w-32" value={twilioAreaCode} onChange={(e) => setTwilioAreaCode(e.target.value)} placeholder="415" />
                </div>
                <Button onClick={handleSearchTwilio} disabled={searchingTwilio || !twilioCountry.trim()} className="text-xs">
                  {searchingTwilio ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Search
                </Button>
              </div>

              <div className="border border-border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Locality</TableHead>
                      <TableHead>Capabilities</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!searchingTwilio && twilioResults.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                          No results yet — run a search.
                        </TableCell>
                      </TableRow>
                    )}
                    {twilioResults.map((n) => (
                      <TableRow key={n.phoneNumber}>
                        <TableCell className="font-semibold text-sm">{n.phoneNumber}</TableCell>
                        <TableCell className="text-xs">{[n.locality, n.region].filter(Boolean).join(", ") || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {Object.entries(n.capabilities).filter(([, v]) => v).map(([k]) => k).join(", ")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="text-xs"
                            disabled={purchasingNumber === n.phoneNumber}
                            onClick={() => openClaimDialog("twilio", n.phoneNumber, undefined, n.isoCountry)}
                          >
                            {purchasingNumber === n.phoneNumber && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            Purchase & claim
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Buy from Africa's Talking — no search/buy API exists for AT (confirmed
          against their full API reference), so this claims from a pool a
          platform admin stocks by hand via Admin → Phone Number Inventory
          after acquiring numbers on AT's own dashboard. */}
      <Dialog open={buyAtOpen} onOpenChange={setBuyAtOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PhoneCall className="h-4 w-4 text-primary" /> Buy from Africa's Talking</DialogTitle>
            <DialogDescription>
              {atConnected
                ? "Africa's Talking has no live number search — a platform admin adds numbers here after acquiring them on AT's own dashboard. Claiming assigns one to this workspace immediately."
                : "Africa's Talking isn't connected yet — a platform admin needs to add Africa's Talking credentials (Settings → Credentials) first."}
            </DialogDescription>
          </DialogHeader>
          {atConnected && (
            <div className="border border-border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Capabilities</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingAtPool && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingAtPool && atPool.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                        No Africa's Talking numbers in stock yet — add one via Admin → Phone Number Inventory after acquiring it on AT's dashboard.
                      </TableCell>
                    </TableRow>
                  )}
                  {atPool.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-semibold text-sm">{n.number}</TableCell>
                      <TableCell className="text-xs">{n.country}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{n.capabilities.join(", ")}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="text-xs"
                          disabled={claimingId === n.id}
                          onClick={() => openClaimDialog("pool", n.number, n.id)}
                        >
                          {claimingId === n.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                          Claim
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Claim confirmation — shared by both buy modals */}
      <Dialog open={!!claimDialogNumber} onOpenChange={(open) => !open && setClaimDialogNumber(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> Claim {claimDialogNumber?.number}</DialogTitle>
            <DialogDescription>
              {claimDialogNumber?.kind === "twilio"
                ? "This purchases the number from Twilio at full price and assigns it exclusively to this workspace."
                : "This number becomes exclusively owned by this workspace until released back to the pool."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-xs font-semibold text-muted-foreground">Assign to agent (optional)</label>
            <Select value={claimAgentId} onValueChange={setClaimAgentId}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClaimDialogNumber(null)}>Cancel</Button>
            <Button onClick={handleConfirmClaim} disabled={purchasingNumber !== null || claimingId !== null}>
              {(purchasingNumber !== null || claimingId !== null) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
