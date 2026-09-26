"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Badge } from "@libs/shadcn-ui/components/ui/badge";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@libs/shadcn-ui/components/ui/table";
import { Loader2 } from "lucide-react";
import { listContacts, type Contact } from "../../../../../utils/contactApi";

const PAGE_SIZE = 20;

export default function ContactsPage() {
  const router = useRouter();
  const routeParams = useParams<{ workspaceId: string }>();
  const workspaceId = (routeParams?.workspaceId as string) || "";

  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    try {
      const result = await listContacts(search || undefined, page, PAGE_SIZE);
      setContacts(result.contacts);
      setTotal(result.total);
    } catch (e: any) {
      if (String(e?.message || "").includes("403")) setForbidden(true);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <p className="text-sm text-muted-foreground">
          Every resolved customer identity across calls and chats, with their mem0 memory state.
        </p>
      </div>

      {forbidden ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Contacts are only visible to workspace admins/owners.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <Input
                placeholder="Search by phone or name…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="max-w-xs"
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts yet.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone / ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Latest issue</TableHead>
                      <TableHead>Resolved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/workspace/${workspaceId}/contacts/${c.id}`)}
                      >
                        <TableCell>{c.externalId}</TableCell>
                        <TableCell>{c.displayName || "—"}</TableCell>
                        <TableCell>{c.channel}</TableCell>
                        <TableCell className="max-w-xs truncate">{c.metadata?.lastIssue || "—"}</TableCell>
                        <TableCell>
                          {c.metadata?.resolved === undefined ? (
                            "—"
                          ) : (
                            <Badge variant={c.metadata.resolved ? "outline" : "destructive"} className="text-xs">
                              {c.metadata.resolved ? "Resolved" : "Open"}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between mt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Prev
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * PAGE_SIZE >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
