"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card";
import { Badge } from "@libs/shadcn-ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@libs/shadcn-ui/components/ui/table";
import { Loader2, PhoneCall, MessageSquare } from "lucide-react";
import { getContact, getContactMemories, type ContactDetail, type ContactMemory } from "../../../../../../utils/contactApi";

export default function ContactDetailPage() {
  const routeParams = useParams<{ contactId: string }>();
  const contactId = (routeParams?.contactId as string) || "";

  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [memories, setMemories] = useState<ContactMemory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contactId) return;
    (async () => {
      setLoading(true);
      try {
        const [detail, mem] = await Promise.all([getContact(contactId), getContactMemories(contactId)]);
        setContact(detail);
        setMemories(mem);
      } finally {
        setLoading(false);
      }
    })();
  }, [contactId]);

  if (loading) {
    return (
      <div className="p-6">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Contact not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">{contact.displayName || contact.externalId}</h1>
        <p className="text-sm text-muted-foreground">
          {contact.externalId} · {contact.channel}
        </p>
        {contact.metadata?.lastIssue && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm">{contact.metadata.lastIssue}</span>
            <Badge variant={contact.metadata.resolved ? "outline" : "destructive"} className="text-xs">
              {contact.metadata.resolved ? "Resolved" : "Open"}
            </Badge>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Unified history</CardTitle>
        </CardHeader>
        <CardContent>
          {contact.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calls or chats yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contact.timeline.map((entry) => (
                  <TableRow key={`${entry.type}-${entry.id}`}>
                    <TableCell className="flex items-center gap-1.5">
                      {entry.type === "call" ? (
                        <PhoneCall className="h-3.5 w-3.5" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5" />
                      )}
                      {entry.type}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {entry.status || "—"}
                        {entry.disconnectReason ? ` (${entry.disconnectReason})` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(entry.at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Memory (mem0)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {memories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No memories recorded for this contact yet.</p>
          ) : (
            memories.map((m, i) => (
              <div key={i} className="text-xs border rounded-md p-2">
                <div className="flex items-center justify-between text-muted-foreground mb-1">
                  <Badge variant="outline" className="text-[10px]">
                    {m.source}
                  </Badge>
                  <span>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
