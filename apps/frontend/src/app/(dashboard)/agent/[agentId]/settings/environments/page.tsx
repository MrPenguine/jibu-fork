"use client";

import React from "react";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { cn } from "@libs/shadcn-ui/lib/utils";

type EnvItem = {
  key: string;
  name: string;
  author: string;
  status: string; // e.g., "Unpublished" or "Published a day ago"
  color: "green" | "orange" | "blue";
};

const ITEMS: EnvItem[] = [
  { key: "prod", name: "Production", author: "Jared Anchi'ng'a", status: "Unpublished", color: "green" },
  { key: "stage", name: "Staging", author: "Jared Anchi'ng'a", status: "Unpublished", color: "orange" },
  { key: "dev", name: "Development", author: "Jared Anchi'ng'a", status: "Published a day ago", color: "blue" },
];

function StatusRing({ color }: { color: EnvItem["color"] }) {
  const ring = {
    green: "border-green-400",
    orange: "border-orange-400",
    blue: "border-blue-400",
  }[color];

  return (
    <span
      className={cn(
        "inline-block h-8 w-8 rounded-full bg-white",
        "relative",
      )}
    >
      <span className={cn("absolute inset-0 rounded-full border-2", ring)} />
      <span className="absolute inset-1 rounded-full bg-gray-50" />
    </span>
  );
}

export default function EnvironmentsSettingsPage() {
  return (
    <div className="w-full px-6 pb-6 pt-6">
      <h1 className="text-2xl font-semibold mb-4">Environments</h1>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {ITEMS.map((env, idx) => (
          <div
            key={env.key}
            className={cn(
              "flex items-center justify-between gap-4 px-4 py-4",
              idx !== 0 && "border-t border-gray-200"
            )}
          >
            <div className="flex items-center gap-3">
              <StatusRing color={env.color} />
              <div className="leading-tight">
                <div className="font-medium">{env.name}</div>
                <div className="text-xs text-gray-500">
                  {env.author} 
                  <span className="mx-1">•</span>
                  {env.status}
                </div>
              </div>
            </div>
            <div>
              <Button variant="outline" size="sm">Override secrets</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
