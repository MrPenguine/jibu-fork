"use client";

import { useOrganization } from "../../../../utils/organizationContext";
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton";
import { Separator } from "@libs/shadcn-ui/components/ui/separator";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card";
import { Badge } from "@libs/shadcn-ui/components/ui/badge";
import { MessageSquare, LayoutGrid, Calendar, Users, HeadphonesIcon, FileText, Bot } from "lucide-react";

export default function WorkspaceHomePage({ params }: { params: { workspaceId: string } }) {
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

  const isSameWorkspace = params.workspaceId === activeOrganization.id;

  return (
    <div className="w-full px-6 pb-6 pt-0">
      <div className="max-w-[1600px] mx-auto">
        <div className="mt-0">
          <h1 className="text-3xl font-bold tracking-tight">My workspace</h1>
          <p className="text-muted-foreground">
            {activeOrganization.name} {isSameWorkspace ? "" : `(viewing ${params.workspaceId})`}
          </p>
        </div>

        <Separator className="mt-6" />

        {/* Central "What do you want to build" widget */}
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <div className="max-w-2xl w-full bg-background rounded-lg p-8 shadow-sm border">
            <h2 className="text-2xl font-semibold mb-4">Hi Jibu, what do you want to build?</h2>
            <div className="relative">
              <Input 
                className="w-full py-6 px-4 text-base" 
                placeholder="Describe what kind of agent is supposed to do - be specific" 
              />
              <Button 
                className="absolute right-1 top-1 bottom-1" 
                size="icon"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                </svg>
              </Button>
            </div>
            
            {/* Category buttons */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <Badge variant="outline" className="py-2 px-3 cursor-pointer hover:bg-accent">Customer support</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer hover:bg-accent">Receptionist</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer hover:bg-accent">Lead generation</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer hover:bg-accent">Outbound sales</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer hover:bg-accent">Rental service</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer hover:bg-accent">Appointment booking</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer hover:bg-accent">Product recommendation</Badge>
            </div>
          </div>
        </div>

        {/* Recent section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Recent</h3>
          <div className="bg-white rounded-lg border p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 p-2 rounded-md">
                <Bot size={16} className="text-white" />
              </div>
              <div>
                <h4 className="font-medium">Sales Prospector (Phone)</h4>
                <p className="text-sm text-muted-foreground">Last used 7 days ago</p>
              </div>
            </div>
          </div>
        </div>

        {/* Templates section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Template 1 */}
            <Card>
              <CardHeader className="pb-2">
                <div className="h-8 w-8 bg-green-100 rounded-md flex items-center justify-center mb-2">
                  <Bot className="h-4 w-4 text-green-700" />
                </div>
                <CardTitle className="text-base">Basic template</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Get up and running quickly with an AI that can answer questions about your business
              </CardContent>
            </Card>

            {/* Template 2 */}
            <Card>
              <CardHeader className="pb-2">
                <div className="h-8 w-8 bg-red-100 rounded-md flex items-center justify-center mb-2">
                  <MessageSquare className="h-4 w-4 text-red-700" />
                </div>
                <CardTitle className="text-base">Customer support</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Handle customer inquiries with an AI that can respond to common questions and issues
              </CardContent>
            </Card>

            {/* Template 3 */}
            <Card>
              <CardHeader className="pb-2">
                <div className="h-8 w-8 bg-blue-100 rounded-md flex items-center justify-center mb-2">
                  <LayoutGrid className="h-4 w-4 text-blue-700" />
                </div>
                <CardTitle className="text-base">Lead qualification</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Qualify leads by asking questions and routing them to the right team members
              </CardContent>
            </Card>

            {/* Template 4 */}
            <Card>
              <CardHeader className="pb-2">
                <div className="h-8 w-8 bg-orange-100 rounded-md flex items-center justify-center mb-2">
                  <Calendar className="h-4 w-4 text-orange-700" />
                </div>
                <CardTitle className="text-base">Appointment scheduler</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Book, update, reschedule, or cancel appointments for your business
              </CardContent>
            </Card>

            {/* Template 5 */}
            <Card>
              <CardHeader className="pb-2">
                <div className="h-8 w-8 bg-slate-100 rounded-md flex items-center justify-center mb-2">
                  <HeadphonesIcon className="h-4 w-4 text-slate-700" />
                </div>
                <CardTitle className="text-base">IVR collector</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Collect information from callers with a voice-based interactive system
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tutorials section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Tutorials</h3>
          <div className="relative bg-slate-900 rounded-lg overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" fill="white"/>
                </svg>
              </div>
            </div>
            <img 
              src="/tutorial-thumbnail.jpg" 
              alt="Building an Agent" 
              className="w-full h-auto opacity-60"
              style={{ height: '180px', objectFit: 'cover' }}
            />
            <div className="absolute bottom-0 left-0 p-4 text-white">
              <h4 className="font-medium">Building an Agent</h4>
              <p className="text-xs">1:43</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
