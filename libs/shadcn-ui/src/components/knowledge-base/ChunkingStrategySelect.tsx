"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";

export type ChunkingStrategyKey =
  | "smart"
  | "faq"
  | "clean_html"
  | "headers"
  | "summarize";

const STRATEGIES: Array<{ key: ChunkingStrategyKey; label: string; description: string }> = [
  {
    key: "smart",
    label: "Smart chunking",
    description: "Break up your data into logical sections grouped by topic. Best for complex documents with varied topics.",
  },
  {
    key: "faq",
    label: "FAQ optimization",
    description: "Create sample questions that each section could answer. Best for building FAQs.",
  },
  {
    key: "clean_html",
    label: "Remove HTML and noise",
    description: "Cleans up messy website formatting to make text easier to group. Best for website or markdown formatting.",
  },
  {
    key: "headers",
    label: "Add topic headers",
    description: "Adds brief summaries at the start of each section. Best for long documents needing context.",
  },
  {
    key: "summarize",
    label: "Summarize",
    description: "Keeps only the key points and removes filler content. Best for dense, lengthy content.",
  },
];

interface ChunkingStrategySelectProps {
  value: ChunkingStrategyKey[];
  onChange: (keys: ChunkingStrategyKey[]) => void;
  placeholder?: string;
}

export function ChunkingStrategySelect({ value, onChange, placeholder = "Select strategy (optional)" }: ChunkingStrategySelectProps) {
  const selectedLabels = STRATEGIES.filter((s) => value.includes(s.key)).map((s) => s.label);
  const fullDisplay = selectedLabels.length > 0 ? selectedLabels.join(", ") : placeholder;
  const compactDisplay = (() => {
    if (selectedLabels.length === 0) return placeholder;
    if (selectedLabels.length <= 2) return selectedLabels.join(", ");
    const rest = selectedLabels.length - 2;
    return `${selectedLabels[0]}, ${selectedLabels[1]}, +${rest}`;
  })();

  const toggle = (k: ChunkingStrategyKey) => {
    if (value.includes(k)) onChange(value.filter((v) => v !== k));
    else onChange([...value, k]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          title={fullDisplay}
          aria-label="LLM chunking strategy"
          className="h-10 w-full justify-between font-normal border rounded-md bg-white shadow-sm hover:bg-white px-3 text-left focus-visible:ring-2 focus-visible:ring-blue-500/60 [text-rendering:optimizeLegibility]"
        >
          <span className={(selectedLabels.length === 0 ? "text-slate-500 " : "") + "truncate whitespace-nowrap max-w-[85%]"}>
            {compactDisplay}
          </span>
          <span className="ml-2 text-slate-400">▾</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="left" className="w-80 rounded-xl shadow-lg border bg-white">
        <div className="space-y-2 text-sm">
          {STRATEGIES.map((s) => (
            <label key={s.key} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 accent-blue-600"
                checked={value.includes(s.key)}
                onChange={() => toggle(s.key)}
              />
              <span>
                {s.label}
                <br />
                <span className="text-slate-500">{s.description}</span>
              </span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
