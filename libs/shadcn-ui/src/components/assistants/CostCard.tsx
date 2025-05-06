import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@libs/shadcn-ui/components/ui/tooltip";

type ProviderType = "web" | "twilio" | "vonage";

interface CostCardProps {
  provider: ProviderType;
}

export function CostCard({ provider }: CostCardProps) {
  const costData = {
    web: {
      value: "~$0.15 /min",
      color: "purple-500"
    },
    twilio: {
      value: "~$0.17 /min",
      color: "yellow-500"
    },
    vonage: {
      value: "~$0.17 /min",
      color: "blue-500"
    }
  };

  // Different proportions for each provider
  const providerProportions = {
    web: {
      jibuFixedCost: "w-[15%]",
      deepgram: "w-[20%]",
      gpt4o: "w-[25%]",
      jibu: "w-[15%]",
      provider: "w-[25%]"
    },
    twilio: {
      jibuFixedCost: "w-[10%]",
      deepgram: "w-[15%]",
      gpt4o: "w-[30%]",
      jibu: "w-[15%]",
      provider: "w-[30%]"
    },
    vonage: {
      jibuFixedCost: "w-[12%]",
      deepgram: "w-[15%]",
      gpt4o: "w-[18%]",
      jibu: "w-[30%]",
      provider: "w-[25%]"
    }
  };

  // Get the current provider's proportions
  const currentProportions = providerProportions[provider];

  // Get provider name for tooltip
  const providerName = {
    web: "Web",
    twilio: "Twilio",
    vonage: "Vonage"
  }[provider];

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center">
            <span className="font-medium">Cost</span>
            <div className="ml-2 text-muted-foreground">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="font-medium">{costData[provider].value}</div>
        </div>
        <TooltipProvider>
          <div className="h-2 w-full rounded-full overflow-hidden flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`h-full ${currentProportions.jibuFixedCost} bg-green-500 cursor-help`}></div>
              </TooltipTrigger>
              <TooltipContent className="border-0 shadow-md">
                <p>Jibu Fixed Cost</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`h-full ${currentProportions.deepgram} bg-orange-500 cursor-help`}></div>
              </TooltipTrigger>
              <TooltipContent className="border-0 shadow-md">
                <p>deepgram</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`h-full ${currentProportions.gpt4o} bg-yellow-500 cursor-help`}></div>
              </TooltipTrigger>
              <TooltipContent className="border-0 shadow-md">
                <p>gpt-4o</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`h-full ${currentProportions.jibu} bg-blue-500 cursor-help`}></div>
              </TooltipTrigger>
              <TooltipContent className="border-0 shadow-md">
                <p>Jibu</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`h-full ${currentProportions.provider} bg-purple-500 cursor-help`}></div>
              </TooltipTrigger>
              <TooltipContent className="border-0 shadow-md">
                <p>{providerName}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
} 