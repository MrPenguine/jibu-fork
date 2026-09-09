"use client";

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@libs/shadcn-ui/components/ui/card';
import { Button } from '@libs/shadcn-ui/components/ui/button';
import { Workflow, User } from 'lucide-react';

export default function CmsPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  return (
    <div className="container p-6">
      <h1 className="text-2xl font-bold mb-6">Agent Configuration</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="  transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center mr-4">
                <Workflow className="text-primary" size={24} />
              </div>
              <h2 className="text-xl font-semibold">Workflows</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              Design and manage conversation flows for your agent. Create different paths and responses based on user inputs.
            </p>
            <Button 
              variant="default" 
              onClick={() => router.push(`/agents/${agentId}/cms/workflows`)}
            >
              Manage Workflows
            </Button>
          </CardContent>
        </Card>

        <Card className="  transition-shadow duration-200">
          <CardContent className="p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center mr-4">
                <User className="text-primary" size={24} />
              </div>
              <h2 className="text-xl font-semibold">Assistant</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              Configure your assistant's personality, knowledge base, and capabilities to create a unique and effective interaction experience.
            </p>
            <Button 
              variant="default" 
              onClick={() => router.push(`/agents/${agentId}/cms/assistant`)}
            >
              Configure Assistant
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}