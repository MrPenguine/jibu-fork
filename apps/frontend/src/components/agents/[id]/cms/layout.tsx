"use client";

import React from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { 
  Workflow, 
  User, 
  Wrench, 
  MessageSquare, 
  Component, 
  Calendar, 
  Variable, 
  Command, 
  Database 
} from 'lucide-react';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  isActive: boolean;
}

const NavItem = ({ href, icon, label, count, isActive }: NavItemProps) => (
  <Link href={href}>
    <div className={`flex items-center px-3 py-2 rounded-md text-sm group ${
      isActive ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`}>
      <span className="mr-3">{icon}</span>
      <span className="flex-grow">{label}</span>
      {count !== undefined && (
        <span className={`px-2 py-0.5 text-xs rounded-full ${
          isActive ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          {count}
        </span>
      )}
    </div>
  </Link>
);

export default function CmsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const agentId = params.id as string;
  const pathname = usePathname();
  
  const navItems = [
    { 
      href: `/agents/${agentId}/cms/workflows`, 
      icon: <Workflow size={18} />, 
      label: 'Workflows', 
      count: 4,
      path: 'workflows'
    },
    { 
      href: `/agents/${agentId}/cms/assistant`, 
      icon: <User size={18} />, 
      label: 'Assistant', 
      count: 1,
      path: 'assistant'
    },
    { 
      href: `/agents/${agentId}/cms/tools`, 
      icon: <Wrench size={18} />, 
      label: 'Tools', 
      count: 1,
      path: 'tools'
    },
    { 
      href: `/agents/${agentId}/cms/prompts`, 
      icon: <Command size={18} />, 
      label: 'Prompts', 
      count: 0,
      path: 'prompts'
    },
    { 
      href: `/agents/${agentId}/cms/messages`, 
      icon: <MessageSquare size={18} />, 
      label: 'Messages', 
      count: 49,
      path: 'messages'
    },
    { 
      href: `/agents/${agentId}/cms/components`, 
      icon: <Component size={18} />, 
      label: 'Components', 
      count: 2,
      path: 'components'
    },
    { 
      href: `/agents/${agentId}/cms/events`, 
      icon: <Calendar size={18} />, 
      label: 'Events', 
      count: 0,
      path: 'events'
    },
    { 
      href: `/agents/${agentId}/cms/variables`, 
      icon: <Variable size={18} />, 
      label: 'Variables', 
      count: 23,
      path: 'variables'
    },
    { 
      href: `/agents/${agentId}/cms/entities`, 
      icon: <Database size={18} />, 
      label: 'Entities', 
      count: 3,
      path: 'entities'
    },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar */}
      <div className="w-48 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 font-medium text-gray-800">Content</div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.label}
              href={item.href}
              icon={item.icon}
              label={item.label}
              count={item.count}
              isActive={pathname.includes(item.path)}
            />
          ))}
        </div>
        
        {/* Tutorial Section */}
        <div className="mt-auto border-t border-gray-200">
          <div className="p-4">
            <div className="flex items-center justify-between text-sm text-gray-800">
              <span>Tutorials</span>
              <span className="bg-gray-200 p-1 rounded">►</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">Complete an export</div>
          </div>
          
          {/* Free Trial Section */}
          <div className="p-4 border-t border-gray-200">
            <div className="text-sm text-gray-800">Free trial</div>
            <div className="text-xs text-gray-500 mt-1">Your trial ends in 7 days.</div>
            <button className="w-full mt-2 bg-primary hover:bg-primary/90 py-2 rounded text-xs font-medium text-white">
              Upgrade now
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}