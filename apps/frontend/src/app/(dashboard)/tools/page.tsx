'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@libs/shadcn-ui/src/components/ui/card';
import { Input } from '@libs/shadcn-ui/src/components/ui/input';
import { Button } from '@libs/shadcn-ui/src/components/ui/button';
import { CalendarIcon, Hash, Music, Code, MessageSquare, Plus, Search } from 'lucide-react';
import { useState } from 'react';

// Define the tool interface
interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  path: string;
}

// List of available tools
const tools: Tool[] = [
  {
    id: 'google_calendar_check',
    name: 'Google Calendar',
    description: 'Check availability and schedule events in Google Calendar',
    icon: CalendarIcon,
    color: 'bg-cyan-500',
    path: '/tools/google-calendar',
  },
  {
    id: 'mcp_tool',
    name: 'MCP Tool',
    description: 'Media Control Protocol integration',
    icon: Music,
    color: 'bg-pink-500',
    path: '/tools/mcp',
  },
  {
    id: 'dtmf_tool',
    name: 'DTMF Tool',
    description: 'Dual-tone multi-frequency signaling',
    icon: Hash,
    color: 'bg-amber-500',
    path: '/tools/dtmf',
  },
  {
    id: 'function_tool',
    name: 'Function Tool',
    description: 'Execute custom JavaScript functions',
    icon: Code,
    color: 'bg-purple-500',
    path: '/tools/function',
  },
  {
    id: 'slack_send_message_tool',
    name: 'Slack Message Tool',
    description: 'Send messages to Slack channels',
    icon: MessageSquare,
    color: 'bg-slate-800',
    path: '/tools/slack',
  },
];

export default function ToolsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter tools based on search query
  const filteredTools = tools.filter(tool => 
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tools</h1>
        <Button className="bg-teal-600 hover:bg-teal-700">
          <Plus className="mr-2 h-4 w-4" /> Create Tool
        </Button>
      </div>
      
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
        <Input
          className="pl-10"
          placeholder="Search Tools"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => (
          <Link key={tool.id} href={tool.path}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className={`p-2 rounded-md ${tool.color} text-white`}>
                  <tool.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{tool.name}</CardTitle>
                  <CardDescription className="text-xs">{tool.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
