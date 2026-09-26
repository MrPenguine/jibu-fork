"use client";

import { useWorkspace } from "../../../../utils/workspaceContext";
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton";
import { Separator } from "@libs/shadcn-ui/components/ui/separator";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Card, CardContent } from "@libs/shadcn-ui/components/ui/card";
import { Badge } from "@libs/shadcn-ui/components/ui/badge";
import { TemplateCard, type AgentTemplate } from "@libs/shadcn-ui/components/workspace/TemplateCard";
import { MessageSquare, LayoutGrid, Calendar, HeadphonesIcon, Bot, Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

// Data, not markup — each template renders through the same <TemplateCard>,
// so adding/editing a template means editing this array, not copy-pasting a
// Card block. bgClass/textClass/iconWrapClass all reference real brand-*
// tokens (tailwind.config.js), never one-off hex values.
const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "basic",
    icon: Bot,
    title: "Basic template",
    description: "Get up and running quickly with an AI that can answer questions about your business",
    bgClass: "bg-brand-green",
    textClass: "text-white",
    iconWrapClass: "bg-white/20",
  },
  {
    id: "customer-support",
    icon: MessageSquare,
    title: "Customer support",
    description: "Handle customer inquiries with an AI that can respond to common questions and issues",
    bgClass: "bg-brand-cinnabar",
    textClass: "text-white",
    iconWrapClass: "bg-white/20",
  },
  {
    id: "lead-qualification",
    icon: LayoutGrid,
    title: "Lead qualification",
    description: "Qualify leads by asking questions and routing them to the right team members",
    bgClass: "bg-brand-mint",
    textClass: "text-brand-navy",
    iconWrapClass: "bg-brand-navy/10",
  },
  {
    id: "appointment-scheduler",
    icon: Calendar,
    title: "Appointment scheduler",
    description: "Book, update, reschedule, or cancel appointments for your business",
    bgClass: "bg-brand-saffron",
    textClass: "text-brand-charcoal",
    iconWrapClass: "bg-brand-charcoal/10",
  },
  {
    id: "ivr-collector",
    icon: HeadphonesIcon,
    title: "IVR collector",
    description: "Collect information from callers with a voice-based interactive system",
    bgClass: "bg-brand-palatinate",
    textClass: "text-white",
    iconWrapClass: "bg-white/20",
  },
];

// Add shake animation styles
const shakeStyles = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-1px); }
    20%, 40%, 60%, 80% { transform: translateX(1px); }
  }
`;

export default function WorkspaceHomePage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId;
  const { activeWorkspace, loading } = useWorkspace();
  const router = useRouter();

  // Real navigation, not decoration — takes the user to the agents list to
  // create one from this starting point. Pre-filling the template itself is
  // a follow-up; this at least goes somewhere real instead of doing nothing.
  const handleSelectTemplate = (template: AgentTemplate) => {
    router.push(`/workspace/${workspaceId}/agents?template=${template.id}`);
  };

  if (loading || !activeWorkspace) {
    return (
      <div className="w-full px-6 pb-6 pt-0">
        <div className="max-w-[1600px] mx-auto">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-4 w-2/3 mt-2" />
          <Separator className="mt-6" />
          <div className="flex justify-center mt-8">
            <Skeleton className="h-[240px] w-2/3 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const isSameWorkspace = workspaceId === activeWorkspace.id;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: shakeStyles }} />
      <div className="w-full px-6 pb-6 pt-0">
        <div className="max-w-[1600px] mx-auto">
        <div className="mt-0">
          <h1 className="text-3xl font-bold tracking-tight">My workspace</h1>
          <p className="text-muted-foreground">
            {activeWorkspace.name} {isSameWorkspace ? "" : `(viewing ${workspaceId})`}
          </p>
        </div>

        <Separator className="mt-6 bg-gray-200" />

        {/* Central "What do you want to build" widget */}
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <div className="max-w-2xl w-full bg-accent rounded-lg p-8 shadow-sm border border-brand-green/10">
            <h2 className="text-2xl font-semibold mb-4">Hi Jibu, what do you want to build?</h2>
            <div className="relative">
              <Input
                className="w-full py-6 px-4 text-base rounded-md border-border focus:border-brand-green focus:ring-brand-green"
                placeholder="Describe what kind of agent is supposed to do - be specific"
              />
              <Button
                className="absolute right-1 top-1 bottom-1 bg-brand-green hover:bg-brand-green/90 rounded-lg"
                size="icon"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                </svg>
              </Button>
            </div>
            
            {/* Category buttons */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-border hover:bg-accent hover:text-brand-green hover:border-brand-green hover:scale-105 transition-all duration-200">Customer support</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-border hover:bg-accent hover:text-brand-green hover:border-brand-green hover:scale-105 transition-all duration-200">Receptionist</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-border hover:bg-accent hover:text-brand-green hover:border-brand-green hover:scale-105 transition-all duration-200">Lead generation</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-border hover:bg-accent hover:text-brand-green hover:border-brand-green hover:scale-105 transition-all duration-200">Outbound sales</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-border hover:bg-accent hover:text-brand-green hover:border-brand-green hover:scale-105 transition-all duration-200">Rental service</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-border hover:bg-accent hover:text-brand-green hover:border-brand-green hover:scale-105 transition-all duration-200">Appointment booking</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-border hover:bg-accent hover:text-brand-green hover:border-brand-green hover:scale-105 transition-all duration-200">Product recommendation</Badge>
            </div>
          </div>
        </div>

        {/* Recent section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Recent</h3>
          <Card className="rounded-lg bg-brand-palatinate/10 hover:scale-[1.02] transition-all duration-200 cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-brand-palatinate p-3 rounded-lg">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <h4 className="font-medium text-brand-charcoal">Sales Prospector (Phone)</h4>
                  <p className="text-sm text-muted-foreground">Last used 7 days ago</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Templates section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Templates</h3>
          <div className="flex gap-4 overflow-x-auto py-4 px-2">
            {AGENT_TEMPLATES.map((template) => (
              <TemplateCard key={template.id} template={template} onSelect={handleSelectTemplate} />
            ))}

            {/* More Button — a "browse more" CTA, not an agent template, so
                it stays outside the AGENT_TEMPLATES data/TemplateCard pattern. */}
            <Card className="bg-card border-2 border-dashed border-border rounded-lg hover:bg-gray-200 hover:border-gray-400 transition-all duration-200 cursor-pointer h-[360px] w-[240px] flex-shrink-0 flex items-center justify-center">
              <div className="text-center">
                <div className="h-16 w-16 bg-gray-200 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-gray-700">View More</p>
                <p className="text-sm text-muted-foreground mt-1">Explore templates</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Tutorials section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Tutorials</h3>
          <div className="relative bg-brand-navy rounded-lg overflow-hidden transition-shadow duration-200 cursor-pointer">
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors duration-200">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" fill="white"/>
                </svg>
              </div>
            </div>
            <div className="h-48 bg-gradient-to-br from-brand-navy to-brand-green/20"></div>
            <div className="absolute bottom-0 left-0 p-6 text-white">
              <h4 className="font-semibold text-lg">Building an Agent</h4>
              <p className="text-sm text-white/80">1:43</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
