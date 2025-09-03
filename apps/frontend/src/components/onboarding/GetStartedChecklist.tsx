"use client";

import React from "react";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@libs/shadcn-ui/components/ui/card";
import Link from "next/link";

export interface ChecklistStatus {
  createdAgent: boolean;
  addedNumber: boolean;
  invitedMember: boolean;
}

interface Props {
  status: ChecklistStatus;
  workspaceId?: string;
}

const GetStartedChecklist: React.FC<Props> = ({ status, workspaceId }) => {
  const items = [
    {
      key: "createdAgent",
      title: "Create your first agent",
      description: "Build an assistant to handle your calls or chats.",
      href: "/agents",
      done: status.createdAgent,
    },
    {
      key: "addedNumber",
      title: "Add a phone number",
      description: "Buy or connect a number to route calls to your agent.",
      href: workspaceId ? `/workspace/${workspaceId}/settings/phone-numbers` : "#",
      done: status.addedNumber,
    },
    {
      key: "invitedMember",
      title: "Invite a teammate",
      description: "Collaborate with your team by inviting members.",
      href: workspaceId ? `/workspace/${workspaceId}/settings/members` : "#",
      done: status.invitedMember,
    },
  ] as const;

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle>Get started</CardTitle>
        <CardDescription>Complete these steps to set up your workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
              <div className="flex items-center gap-3">
                {item.done ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                </div>
              </div>
              <Button asChild size="sm" variant={item.done ? "secondary" : "default"}>
                <Link href={item.href}>
                  {item.done ? "View" : "Start"}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default GetStartedChecklist;
