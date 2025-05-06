"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icons } from "@/components/ui/icons";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type SipTrunkConfigProps = {
  className?: string;
};

export function SipTrunkConfig({ className = "" }: SipTrunkConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gatewayCount, setGatewayCount] = useState(1);

  const Gateway = ({ number }: { number: number }) => (
    <div className="space-y-4 p-4 border rounded-lg bg-background/50">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">Gateway #{number}</h4>
        {number > 1 && (
          <button className="text-destructive" onClick={() => setGatewayCount(prev => prev - 1)}>
            <Icons.trash className="h-4 w-4" />
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        <div>
          <Label>IP Address / Domain *</Label>
          <Input placeholder="IPv4 address or domain name" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Port</Label>
            <Input placeholder="5060" />
          </div>
          <div>
            <Label>Netmask</Label>
            <Input placeholder="32" />
          </div>
        </div>

        <div>
          <Label>Outbound Protocol</Label>
          <Select>
            <option value="udp">UDP</option>
            <option value="tcp">TCP</option>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Switch id={`inbound-${number}`} />
            <Label htmlFor={`inbound-${number}`}>Allow inbound calls</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id={`outbound-${number}`} />
            <Label htmlFor={`outbound-${number}`}>Allow outbound calls</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id={`ping-${number}`} />
            <Label htmlFor={`ping-${number}`}>Enable options ping</Label>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Add New SIP Trunk</CardTitle>
        <CardDescription>Configure a new SIP trunk connection</CardDescription>
      </CardHeader>
      <CardContent>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button className="w-full" variant={isOpen ? "secondary" : "default"}>
              <Icons.plus className="mr-2 h-4 w-4" />
              Configure New SIP Trunk
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-4 space-y-6">
            <div>
              <Label>Name *</Label>
              <Input placeholder="My SIP Trunk" />
              <p className="text-sm text-muted-foreground mt-1">Choose a name for this trunk</p>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Gateway Configuration</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure at least one SIP gateway where your trunk provider accepts connections.
                <a href="#" className="text-primary ml-2 hover:underline">Read the docs</a>
              </p>

              <div className="space-y-4">
                {Array.from({ length: gatewayCount }).map((_, i) => (
                  <Gateway key={i} number={i + 1} />
                ))}
              </div>

              <Button 
                variant="outline" 
                className="mt-4 w-full"
                onClick={() => setGatewayCount(prev => prev + 1)}
              >
                Add Another Gateway
              </Button>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Authentication (Optional)</h3>
              <div className="space-y-4">
                <div>
                  <Label>Username</Label>
                  <Input placeholder="Authentication username" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" placeholder="Authentication password" />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="sip-registration" />
                  <Label htmlFor="sip-registration">Use SIP Registration</Label>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Advanced Settings (Optional)</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch id="meeting-join" />
                  <Label htmlFor="meeting-join">Enable Meeting joins for outbound calls</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="cluster-sip" />
                  <Label htmlFor="cluster-sip">Use Cluster SIP</Label>
                </div>
                <div>
                  <Label>Tech Prefix</Label>
                  <Input placeholder="Tech prefix for outbound calls" />
                </div>
                <div>
                  <Label>SIP Diversion Header</Label>
                  <Input placeholder="SIP diversion header" />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button>
                Save SIP Trunk
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
} 