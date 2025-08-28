"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { SidebarMenu, SidebarMenuItem } from "../ui/sidebar";
import {
  BadgeHelp,
  KeyRound,
  Layers,
  Link2,
  Settings,
  Shield,
} from "lucide-react";

function SettingsItem({
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
      <Link href={href} className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        isActive ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
      )}>
        {React.cloneElement(icon, { className: cn("h-4 w-4") })}
        <span>{label}</span>
      </Link>
    </SidebarMenuItem>
  );
}

export function AgentSettingsSidebar({ agentId }: { agentId: string }) {
  return (
    <aside className="h-full w-64 bg-gray-900 text-white border-r border-gray-800">
      <div className="h-14 px-4 flex items-center">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </div>
      </div>
      <div className="px-2">
        <SidebarMenu className="gap-1">
          <SettingsItem href={`/agent/${agentId}/settings/general`} icon={<Settings />} label="General" />
          <SettingsItem href={`/agent/${agentId}/settings/behaviour`} icon={<Shield />} label="Behaviour" />
          <SettingsItem href={`/agent/${agentId}/settings/integrations`} icon={<Link2 />} label="Integrations" />
          <SettingsItem href={`/agent/${agentId}/settings/environments`} icon={<Layers />} label="Environments" />
          <SettingsItem href={`/agent/${agentId}/settings/secrets`} icon={<KeyRound />} label="Secrets" />
          <SettingsItem href={`/agent/${agentId}/settings/api`} icon={<BadgeHelp />} label="API" />
        </SidebarMenu>
      </div>
    </aside>
  );
}

export default AgentSettingsSidebar;
