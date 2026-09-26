import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@libs/shadcn-ui/components/ui/card";
import { cn } from "@libs/shadcn-ui/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface AgentTemplate {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Tailwind class for the card's background, e.g. "bg-brand-green" */
  bgClass: string;
  /** Tailwind class for title/description/icon text color */
  textClass: string;
  /** Tailwind class for the icon's own wrapper background (usually a low-opacity tint of textClass) */
  iconWrapClass: string;
}

interface TemplateCardProps {
  template: AgentTemplate;
  onSelect: (template: AgentTemplate) => void;
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const { icon: Icon, title, description, bgClass, textClass, iconWrapClass } = template;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(template)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(template);
        }
      }}
      aria-label={`Start a new agent from the ${title} template`}
      className={cn(
        bgClass,
        "rounded-lg hover:scale-105 hover:shadow-2xl transition-all duration-200 cursor-pointer overflow-hidden h-[360px] w-[240px] flex-shrink-0 flex flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      )}
    >
      <CardHeader className="pb-4 pt-6 flex-grow">
        <div className={cn(iconWrapClass, "h-16 w-16 rounded-lg flex items-center justify-center mb-6")}>
          <Icon className={cn(textClass, "h-8 w-8")} />
        </div>
        <CardTitle className={cn(textClass, "text-lg mb-3")}>{title}</CardTitle>
        <CardDescription className={cn(textClass, "text-sm opacity-90 leading-relaxed")}>
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
