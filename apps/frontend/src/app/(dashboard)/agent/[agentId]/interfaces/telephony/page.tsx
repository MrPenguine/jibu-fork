"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@libs/shadcn-ui/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@libs/shadcn-ui/components/ui/accordion";

export default function TelephonyInterfacePage() {
  return (
    <div className="w-full px-6 pb-6 pt-6">
      <h1 className="text-2xl font-semibold mb-6">Interfaces / Telephony</h1>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Set up phone numbers, providers, and SIP/WebRTC settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Connect your telephony provider and configure voice settings for this agent.
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Accordion type="single" collapsible>
          <AccordionItem value="providers">
            <AccordionTrigger>Providers</AccordionTrigger>
            <AccordionContent>
              Configure Twilio, Vonage, or custom SIP endpoints.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="ivr">
            <AccordionTrigger>IVR & Call Flow</AccordionTrigger>
            <AccordionContent>
              Define greeting, DTMF handling, and fallback behaviors.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="recording">
            <AccordionTrigger>Recording & Compliance</AccordionTrigger>
            <AccordionContent>
              Enable call recording and set storage/compliance preferences.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
