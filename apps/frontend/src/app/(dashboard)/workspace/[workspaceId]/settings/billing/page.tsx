"use client";

import {
  CustomCard,
  CustomCardContent,
  CustomCardHeader,
  CardTitle,
  CardDescription,
} from "@libs/shadcn-ui/components/ui/custom-card";
import { Separator } from "@libs/shadcn-ui/components/ui/separator";
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton";
import { useOrganization } from "../../../../../../utils/organizationContext";

export default function WorkspaceBillingPage() {
  const { activeOrganization, loading } = useOrganization();

  if (loading || !activeOrganization) {
    return (
      <div className="w-full px-6 pb-6 pt-0">
        <div className="max-w-[1600px] mx-auto">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-4 w-2/3 mt-2" />
          <Separator className="mt-6" />
          <div className="flex justify-center mt-8">
            <Skeleton className="h-[240px] w-2/3 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 pb-6 pt-0">
      <div className="max-w-[1600px] mx-auto">
        <div className="mt-0">
          <h1 className="text-3xl font-bold tracking-tight">Plans & Billing</h1>
          <p className="text-muted-foreground">
            Manage plans and billing for {activeOrganization.name}.
          </p>
        </div>

        <Separator className="mt-6" />

        <div className="flex justify-center mt-8">
          <div className="w-full md:w-2/3">
            <CustomCard>
              <CustomCardHeader>
                <CardTitle>Coming soon</CardTitle>
                <CardDescription>
                  Plan selection, invoices, and payment methods will be available here.
                </CardDescription>
              </CustomCardHeader>
              <CustomCardContent>
                <div className="text-sm text-muted-foreground">
                  We’ll integrate secure billing and subscription management.
                </div>
              </CustomCardContent>
            </CustomCard>
          </div>
        </div>
      </div>
    </div>
  );
}
