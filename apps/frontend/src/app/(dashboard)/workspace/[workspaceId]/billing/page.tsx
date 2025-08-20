"use client"

import * as React from "react"
import { useWorkspace } from "../../../../../utils/workspaceContext"
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card"
import { Badge } from "@libs/shadcn-ui/components/ui/badge"
import { Check, CreditCard } from "lucide-react"

export default function BillingPage({ params }: { params: { workspaceId: string } }) {
  const { activeWorkspace, loading } = useWorkspace();

  if (loading || !activeWorkspace) {
    return (
      <div className="w-full px-6 pb-6 pt-0">
        <Skeleton className="h-10 w-1/3" />
        <div className="mt-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 pb-6 pt-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Plans & Billing</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Free Plan */}
        <Card className="border-2 border-primary">
          <CardHeader>
            <div className="flex justify-between items-center mb-2">
              <CardTitle className="text-lg">Free</CardTitle>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Current Plan</Badge>
            </div>
            <CardDescription>
              <span className="text-3xl font-bold">$0</span>
              <span className="text-muted-foreground">/month</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-primary" />
                <span>1 seat</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-primary" />
                <span>5,000 tokens/month</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-primary" />
                <span>Basic support</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" disabled>Current plan</Button>
          </CardFooter>
        </Card>

        {/* Pro Plan */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center mb-2">
              <CardTitle className="text-lg">Pro</CardTitle>
            </div>
            <CardDescription>
              <span className="text-3xl font-bold">$49</span>
              <span className="text-muted-foreground">/month</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-primary" />
                <span>5 seats</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-primary" />
                <span>100,000 tokens/month</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-primary" />
                <span>Priority support</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-primary" />
                <span>Advanced features</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" variant="outline">Upgrade now</Button>
          </CardFooter>
        </Card>

        {/* Enterprise Plan */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center mb-2">
              <CardTitle className="text-lg">Enterprise</CardTitle>
            </div>
            <CardDescription>
              <span className="text-3xl font-bold">Custom</span>
              <span className="text-muted-foreground"> pricing</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-primary" />
                <span>Unlimited seats</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-primary" />
                <span>Custom token limits</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-primary" />
                <span>Dedicated support</span>
              </li>
              <li className="flex items-center">
                <Check className="h-4 w-4 mr-2 text-primary" />
                <span>Custom integrations</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" variant="outline">Contact sales</Button>
          </CardFooter>
        </Card>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-medium mb-4">Payment method</h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Add a payment method</CardTitle>
            <CardDescription>You don't have any payment methods set up yet</CardDescription>
          </CardHeader>
          <CardFooter className="pt-2">
            <Button variant="outline">
              <CreditCard className="h-4 w-4 mr-2" />
              Add payment method
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-medium mb-4">Billing history</h2>
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No billing history available
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
