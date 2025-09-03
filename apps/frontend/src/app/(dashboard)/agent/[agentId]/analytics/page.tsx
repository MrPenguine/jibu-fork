"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@libs/shadcn-ui/components/ui/card';
import { Skeleton } from '@libs/shadcn-ui/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@libs/shadcn-ui/components/ui/tabs';
// Simple visualization components instead of recharts

export default function AgentAnalyticsPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = React.use(params);
  const [isLoading, setIsLoading] = useState(true);
  const [agent, setAgent] = useState<any>(null);
  const router = useRouter();

  // Mock data for analytics
  const dailyUsageData = [
    { name: 'Mon', usage: 40 },
    { name: 'Tue', usage: 30 },
    { name: 'Wed', usage: 20 },
    { name: 'Thu', usage: 27 },
    { name: 'Fri', usage: 18 },
    { name: 'Sat', usage: 23 },
    { name: 'Sun', usage: 34 },
  ];

  const performanceData = [
    { name: 'Success', value: 85 },
    { name: 'Failure', value: 15 },
  ];

  useEffect(() => {
    const fetchAgentDetails = async () => {
            if (!agentId) {
        router.push('/workspace');
        return;
      }

      try {
        setIsLoading(true);
        // Simulate API call with timeout
        setTimeout(() => {
          setAgent({
                        id: agentId,
            name: 'Sample Agent',
            description: 'This is a sample agent for analytics demonstration',
            totalRuns: 172,
            successRate: '85%',
            avgResponseTime: '1.2s'
          });
          setIsLoading(false);
        }, 1000);
      } catch (error) {
        console.error("Failed to fetch agent details:", error);
        setIsLoading(false);
      }
    };

    fetchAgentDetails();
    }, [agentId, router]);

  if (isLoading) {
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
        <h1 className="text-2xl font-semibold">Analytics</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agent.totalRuns}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agent.successRate}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agent.avgResponseTime}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="usage" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Daily Usage</CardTitle>
              <CardDescription>
                Number of agent runs per day over the last week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex items-end justify-between gap-2">
                {dailyUsageData.map((item) => (
                  <div key={item.name} className="flex flex-col items-center">
                    <div 
                      className="bg-primary w-12 rounded-t-md" 
                      style={{ height: `${item.usage * 2}px` }}
                    />
                    <div className="mt-2 text-xs">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.usage}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Success Rate</CardTitle>
              <CardDescription>
                Percentage of successful agent runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 flex flex-col gap-6 pt-10">
                {performanceData.map((item) => (
                  <div key={item.name} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-20">{item.name}</span>
                      <div className="flex-1 h-8 bg-gray-100 rounded-md overflow-hidden">
                        <div 
                          className={`h-full ${item.name === 'Success' ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                      <span className="w-10 text-right">{item.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
