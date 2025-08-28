"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { SidebarMenu, SidebarMenuItem } from "../ui/sidebar";
import { Monitor, Phone } from "lucide-react";

function InterfacesItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactElement<{ className?: string }>;
  label: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <SidebarMenuItem>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          isActive ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
        )}
      >
        {React.cloneElement(icon, { className: cn("h-4 w-4") })}
        <span>{label}</span>
      </Link>
    </SidebarMenuItem>
  );
}

export default function AgentInterfacesSidebar({ agentId }: { agentId: string }) {
  return (
    <aside className="h-full w-64 bg-gray-900 text-white border-r border-gray-800">
      <div className="h-14 px-4 flex items-center">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Monitor className="h-4 w-4" />
          <span>Interfaces</span>
        </div>
      </div>
      <div className="px-2">
        <SidebarMenu className="gap-1">
          <InterfacesItem href={`/agent/${agentId}/interfaces/widget`} icon={<Monitor />} label="Widget" />
          <InterfacesItem href={`/agent/${agentId}/interfaces/telephony`} icon={<Phone />} label="Telephony" />
        </SidebarMenu>
      </div>
    </aside>
  );
}
