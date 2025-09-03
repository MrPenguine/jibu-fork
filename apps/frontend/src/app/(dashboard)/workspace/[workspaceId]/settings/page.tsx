import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@libs/shadcn-ui/components/ui/card";
import { Phone as PhoneIcon, CreditCard as CreditCardIcon, BarChart as BarChartIcon, Users as UsersIcon } from "lucide-react";

const settingsCards = [
  { title: "Members", description: "Invite and manage team members.", href: "/settings/members", icon: <UsersIcon className="w-5 h-5" /> },
  { title: "Phone Numbers", description: "Buy and manage phone numbers.", href: "/settings/phone-numbers", icon: <PhoneIcon className="w-5 h-5" /> },
  { title: "Plans & Billing", description: "Manage billing and subscriptions.", href: "/settings/billing", icon: <CreditCardIcon className="w-5 h-5" /> },
  { title: "Usage", description: "View usage and quotas.", href: "/settings/usage", icon: <BarChartIcon className="w-5 h-5" /> },
];

export default function SettingsPage({ params }: { params: { workspaceId: string } }) {
  return (
    <div>
      <h1 className="text-3xl font-bold">Settings</h1>
      <div className="grid grid-cols-1 gap-6 mt-6 md:grid-cols-2 lg:grid-cols-3">
        {settingsCards.map((card) => (
          <Link href={`/workspace/${params.workspaceId}${card.href}`} key={card.title}>
            <Card className="h-full transition-all hover:border-primary">
              <CardHeader>
                {card.icon}
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
