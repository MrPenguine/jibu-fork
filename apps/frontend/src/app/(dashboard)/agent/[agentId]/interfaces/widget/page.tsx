"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@libs/shadcn-ui/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@libs/shadcn-ui/components/ui/accordion";
import { Button } from "@libs/shadcn-ui/components/ui/button";

export default function WidgetInterfacePage() {
  const installSnippet = `
<script type="text/javascript">
(function() {
  window.vf = window.vf || function(){ (window.vf.q = window.vf.q || []).push(arguments) };
  vf("init", {
    version: "v1",
    appId: "YOUR_APP_ID",
    website: {
      id: "YOUR_WEBSITE_ID",
      domain: window.location.hostname,
    },
    endpoints: {
      ws: "wss://realtime-api.jibuai.co",
      rest: "https://general-runtime.jibuai.co",
    },
  });

  var s = document.createElement("script");
  s.src = "https://cdn.jibuai.co/widget/bundle.js";
  s.type = "text/javascript";
  s.async = true;
  document.body.appendChild(s);
})();
</script>`;

  return (
    <div className="w-full px-6 pb-6 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Interfaces / Widget</h1>
        <Button variant="outline" size="sm">Publish</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Installation</CardTitle>
          <CardDescription>Paste the snippet before the closing &lt;/body&gt; tag on pages where you want the widget.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-950 text-gray-100 text-xs p-4 rounded-md overflow-auto">
            <code>{installSnippet}</code>
          </pre>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Accordion type="single" collapsible>
          <AccordionItem value="modality">
            <AccordionTrigger>Modality & interface</AccordionTrigger>
            <AccordionContent>
              Configure how the widget appears and how users can invoke it.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="appearance">
            <AccordionTrigger>Appearance & style</AccordionTrigger>
            <AccordionContent>
              Set colors, logo, launcher position and theme.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="security">
            <AccordionTrigger>Security</AccordionTrigger>
            <AccordionContent>
              Control origins, auth and env settings for production.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
