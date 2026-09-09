"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, CircleDashed, Info, Loader2, Trash2, XCircle } from "lucide-react";
import { Badge } from "@libs/shadcn-ui/components/ui/badge";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Card } from "@libs/shadcn-ui/components/ui/card";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { fetchAPI } from "../../../utils/api";
import { toast } from "@libs/shadcn-ui/components/ui/use-toast";

type CredentialStatus = "configured" | "env" | "unset";
type TestStatus = "ok" | "error" | "unsupported";

interface ProviderCredential {
  provider: string;
  label: string;
  status: CredentialStatus;
  lastTest: {
    status: TestStatus | null;
    message: string | null;
    testedAt: string | null;
  } | null;
}

function StatusBadge({ status }: { status: CredentialStatus }) {
  if (status === "configured") {
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Configured
      </Badge>
    );
  }
  if (status === "env") {
    return (
      <Badge variant="warning">
        <CircleDashed className="mr-1 h-3 w-3" />
        Env fallback
      </Badge>
    );
  }
  return (
    <Badge variant="neutral">
      Unset
    </Badge>
  );
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = React.useState<ProviderCredential[]>([]);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [busyProvider, setBusyProvider] = React.useState<string | null>(null);

  const loadCredentials = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAPI("/admin/provider-credentials");
      setCredentials(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast({
        title: "Could not load credentials",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const setCredential = async (provider: ProviderCredential) => {
    const secret = drafts[provider.provider]?.trim();
    if (!secret) {
      toast({ title: "Enter a credential first", variant: "destructive" });
      return;
    }

    try {
      setBusyProvider(provider.provider);
      await fetchAPI(`/admin/provider-credentials/${provider.provider}`, {
        method: "PUT",
        body: JSON.stringify({ secret }),
      });
      setDrafts((current) => ({ ...current, [provider.provider]: "" }));
      toast({ title: `${provider.label} credential saved` });
      await loadCredentials();
    } catch (error: any) {
      toast({
        title: "Could not save credential",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyProvider(null);
    }
  };

  const removeCredential = async (provider: ProviderCredential) => {
    if (!window.confirm(`Remove the stored ${provider.label} credential?`)) return;

    try {
      setBusyProvider(provider.provider);
      await fetchAPI(`/admin/provider-credentials/${provider.provider}`, { method: "DELETE" });
      toast({ title: `${provider.label} credential removed` });
      await loadCredentials();
    } catch (error: any) {
      toast({
        title: "Could not remove credential",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyProvider(null);
    }
  };

  const testCredential = async (provider: ProviderCredential) => {
    try {
      setBusyProvider(provider.provider);
      const result = await fetchAPI(`/admin/provider-credentials/${provider.provider}/test`, {
        method: "POST",
      });
      toast({
        title:
          result?.status === "ok"
            ? `${provider.label} connection succeeded`
            : result?.status === "unsupported"
              ? `${provider.label} testing unavailable`
              : `${provider.label} connection failed`,
        description: result?.message || undefined,
        variant: result?.status === "error" ? "destructive" : "default",
      });
      await loadCredentials();
    } catch (error: any) {
      toast({
        title: "Could not test credential",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Credentials</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage third-party provider credentials shared across all workspaces.
        </p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px]">
            <thead className="border-b bg-background">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Set or replace</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Last test</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-card">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Loading provider credentials…
                  </td>
                </tr>
              ) : credentials.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">No providers registered.</td>
                </tr>
              ) : (
                credentials.map((provider) => {
                  const busy = busyProvider === provider.provider;
                  const lastTest = provider.lastTest?.status ? provider.lastTest : null;
                  return (
                    <tr key={provider.provider} className="hover:bg-background">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{provider.label}</div>
                        <div className="text-xs text-muted-foreground">{provider.provider}</div>
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={provider.status} /></td>
                      <td className="px-6 py-4">
                        <div className="flex max-w-sm gap-2">
                          <Input
                            type="password"
                            value={drafts[provider.provider] || ""}
                            onChange={(event) => setDrafts((current) => ({ ...current, [provider.provider]: event.target.value }))}
                            placeholder="Enter new credential"
                            autoComplete="new-password"
                            aria-label={`New ${provider.label} credential`}
                          />
                          <Button onClick={() => void setCredential(provider)} disabled={busy}>
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                          </Button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {lastTest ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              {lastTest.status === "ok" ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : lastTest.status === "unsupported" ? (
                                <Info className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                              <span>{lastTest.message || (lastTest.status === "ok" ? "Passed" : "Failed")}</span>
                            </div>
                            {lastTest.testedAt && <div className="text-xs text-gray-400">{new Date(lastTest.testedAt).toLocaleString()}</div>}
                          </div>
                        ) : "Not tested"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => void testCredential(provider)} disabled={busy}>Test</Button>
                          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void removeCredential(provider)} disabled={busy || provider.status !== "configured"} aria-label={`Remove ${provider.label} credential`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      <Card className="border-brand-mint bg-brand-mint p-4">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-navy" />
          <div>
            <h2 className="text-sm font-medium text-brand-navy">Credentials are write-only</h2>
            <p className="mt-1 text-sm text-primary">
              Stored values are kept in Vault and can only be replaced or removed. They are never displayed or returned by the API.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
