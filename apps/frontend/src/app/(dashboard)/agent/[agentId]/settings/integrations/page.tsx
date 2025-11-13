"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Label } from "@libs/shadcn-ui/components/ui/label";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";
import { useParams } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@libs/shadcn-ui/components/ui/dialog";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@libs/shadcn-ui/components/ui/select";

type IntegrationItem = {
  key: string;
  name: string;
  description: string;
  icon: string; // public path to svg under /integrations
};

const INTEGRATIONS: IntegrationItem[] = [
  { key: "airtable", name: "Airtable", description: "Integrate with Airtable to sync data or manage your grids.", icon: "/integrations/airtable.svg" },
  { key: "elevenlabs", name: "Eleven Labs", description: "Connect Eleven Labs to add AI voices to your custom voices.", icon: "/integrations/elevenlabs.svg" },
  { key: "gmail", name: "Gmail", description: "Connect to Gmail to send emails.", icon: "/integrations/gmail.svg" },
  { key: "sheets", name: "Google Sheets", description: "Connect to Sheets to read and write data.", icon: "/integrations/googlesheets.svg" },
  { key: "hubspot", name: "HubSpot", description: "Connect HubSpot to manage your data & contacts.", icon: "/integrations/hubspot.svg" },
  { key: "make", name: "Make", description: "Integrate with Make to run your scenarios.", icon: "/integrations/make.svg" },
  { key: "mux", name: "Mux", description: "Integrate with Mux for video processing.", icon: "/integrations/mux.svg" },
  { key: "salesforce", name: "Salesforce", description: "Integrate with Salesforce to manage accounts and leads.", icon: "/integrations/salesforce.svg" },
  { key: "youtube", name: "YouTube", description: "Connect YouTube to manage or access media.", icon: "/integrations/youtube.svg" },
  { key: "twilio", name: "Twilio", description: "Connect to Twilio to send SMS messages.", icon: "/integrations/twilio.svg" },
  { key: "zendesk", name: "Zendesk", description: "Integrate with Zendesk to manage customer support tickets.", icon: "/integrations/zendesk.svg" },
];

export default function IntegrationsSettingsPage() {
  const params = useParams();
  const agentId = (params?.agentId as string) || "";
  const [selected, setSelected] = React.useState<IntegrationItem | null>(null);
  const [open, setOpen] = React.useState(false);
  const [apiKey, setApiKey] = React.useState("");
  const [makeOpen, setMakeOpen] = React.useState(false);
  const [zone, setZone] = React.useState<string>("");
  const [salesforceOpen, setSalesforceOpen] = React.useState(false);
  const [sfSubdomain, setSfSubdomain] = React.useState("");
  const [twilioOpen, setTwilioOpen] = React.useState(false);
  const [twilioKeySid, setTwilioKeySid] = React.useState("");
  const [twilioKeySecret, setTwilioKeySecret] = React.useState("");
  const [twilioAccountSid, setTwilioAccountSid] = React.useState("");
  const [zendeskOpen, setZendeskOpen] = React.useState(false);
  const [zdSubdomain, setZdSubdomain] = React.useState("");

  const MAKE_ZONES = [
    "us1.make.com",
    "us2.make.com",
    "eu1.make.com",
    "eu2.make.com",
    "us1.make.celonis.com",
    "us2.make.celonis.com",
    "eu1.make.celonis.com",
    "eu2.make.celonis.com",
  ];

  const onConnect = (item: IntegrationItem) => {
    if (item.key === "elevenlabs") {
      setSelected(item);
      setOpen(true);
      return;
    }
    if (item.key === "make") {
      setSelected(item);
      setMakeOpen(true);
      return;
    }
    if (item.key === "salesforce") {
      setSelected(item);
      setSalesforceOpen(true);
      return;
    }
    if (item.key === "twilio") {
      setSelected(item);
      setTwilioOpen(true);
      return;
    }
    if (item.key === "zendesk") {
      setSelected(item);
      setZendeskOpen(true);
      return;
    }
    toast({
      title: `${item.name}`,
      description: "Frontend-only preview. Connection flow will be wired later.",
    });
  };

  return (
    <div className="w-full px-6 pb-6 pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-gray-400">Manage external integrations connected to this agent.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {INTEGRATIONS.map((item) => (
          <Card key={item.key} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-gray-50 flex items-center justify-center overflow-hidden">
                  {/* Using img to avoid layout shifts and keep deps minimal */}
                  <img src={item.icon} alt={`${item.name} logo`} className="h-8 w-8 object-contain" />
                </div>
                <div>
                  <CardTitle className="text-base">{item.name}</CardTitle>
                  <Label className="text-xs text-gray-500 font-normal">{item.description}</Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Button className="mt-2 w-full" onClick={() => onConnect(item)}>
                Connect
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Eleven Labs connect modal (frontend-only) */}
      <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect to {selected?.name || "Integration"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="api-key">API key</Label>
            <Input
              id="api-key"
              placeholder="Enter API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                toast({ title: "Saved", description: "API key stored locally (frontend-only)." });
                setOpen(false);
                setApiKey("");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salesforce modal: Subdomain URL */}
      <Dialog open={salesforceOpen} onOpenChange={(o) => setSalesforceOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect to Salesforce</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sf-url">Subdomain URL</Label>
            <Input
              id="sf-url"
              placeholder="Enter url"
              value={sfSubdomain}
              onChange={(e) => setSfSubdomain(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">https://company.my.salesforce.com</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalesforceOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                toast({ title: "Connected", description: sfSubdomain || "No URL" });
                setSalesforceOpen(false);
                setSfSubdomain("");
              }}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Twilio modal: API key SID, secret, account SID */}
      <Dialog open={twilioOpen} onOpenChange={(o) => setTwilioOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect to Twilio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="tw-key-sid">API key SID</Label>
              <Input id="tw-key-sid" placeholder="Enter Twilio api key SID" value={twilioKeySid} onChange={(e) => setTwilioKeySid(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tw-key-secret">API key secret</Label>
              <Input id="tw-key-secret" placeholder="Enter Twilio api key secret" value={twilioKeySecret} onChange={(e) => setTwilioKeySecret(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tw-account-sid">Account SID</Label>
              <Input id="tw-account-sid" placeholder="Enter Twilio account SID" value={twilioAccountSid} onChange={(e) => setTwilioAccountSid(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTwilioOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                toast({ title: "Connected", description: `Key SID: ${twilioKeySid || "—"}` });
                setTwilioOpen(false);
                setTwilioKeySid("");
                setTwilioKeySecret("");
                setTwilioAccountSid("");
              }}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zendesk modal: Subdomain URL */}
      <Dialog open={zendeskOpen} onOpenChange={(o) => setZendeskOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect to Zendesk</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="zd-url">Subdomain URL</Label>
            <Input
              id="zd-url"
              placeholder="Enter url"
              value={zdSubdomain}
              onChange={(e) => setZdSubdomain(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">https://company.zendesk.com</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setZendeskOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                toast({ title: "Connected", description: zdSubdomain || "No URL" });
                setZendeskOpen(false);
                setZdSubdomain("");
              }}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Make connect modal with zone selection (frontend-only) */}
      <Dialog open={makeOpen} onOpenChange={(o) => setMakeOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect to Make</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="make-zone">Organization zone</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger id="make-zone">
                <SelectValue placeholder="Select zone" />
              </SelectTrigger>
              <SelectContent>
                {MAKE_ZONES.map((z) => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The zone can be found at the start of the URL you see when using Make. For example, https://us2.make.com …
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMakeOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                toast({ title: "Connected", description: zone ? `Zone: ${zone}` : "No zone selected" });
                setMakeOpen(false);
                setZone("");
              }}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
