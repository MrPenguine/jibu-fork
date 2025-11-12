"use client";

import { useWorkspace } from "../../../../utils/workspaceContext";
import { Skeleton } from "@libs/shadcn-ui/components/ui/skeleton";
import { Separator } from "@libs/shadcn-ui/components/ui/separator";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card";
import { Badge } from "@libs/shadcn-ui/components/ui/badge";
import { MessageSquare, LayoutGrid, Calendar, Users, HeadphonesIcon, FileText, Bot, Plus } from "lucide-react";
import { useParams } from "next/navigation";

// Add shake animation styles
const shakeStyles = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-1px); }
    20%, 40%, 60%, 80% { transform: translateX(1px); }
  }
`;

export default function WorkspaceHomePage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId;
  const { activeWorkspace, loading } = useWorkspace();

  if (loading || !activeWorkspace) {
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

  const isSameWorkspace = workspaceId === activeWorkspace.id;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: shakeStyles }} />
      <div className="w-full px-6 pb-6 pt-0">
        <div className="max-w-[1600px] mx-auto">
        <div className="mt-0">
          <h1 className="text-3xl font-bold tracking-tight">My workspace</h1>
          <p className="text-muted-foreground">
            {activeWorkspace.name} {isSameWorkspace ? "" : `(viewing ${workspaceId})`}
          </p>
        </div>

        <Separator className="mt-6 bg-gray-200" />

        {/* Central "What do you want to build" widget */}
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <div className="max-w-2xl w-full bg-[#F0FAF5] rounded-2xl p-8 shadow-sm border border-[#009959]/10">
            <h2 className="text-2xl font-semibold mb-4">Hi Jibu, what do you want to build?</h2>
            <div className="relative">
              <Input 
                className="w-full py-6 px-4 text-base rounded-xl border-gray-200 focus:border-[#009959] focus:ring-[#009959]" 
                placeholder="Describe what kind of agent is supposed to do - be specific" 
              />
              <Button 
                className="absolute right-1 top-1 bottom-1 bg-[#009959] hover:bg-[#007a47] rounded-lg" 
                size="icon"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                </svg>
              </Button>
            </div>
            
            {/* Category buttons */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-gray-300 hover:bg-[#E6F7F0] hover:text-[#009959] hover:border-[#009959] hover:scale-105 transition-all duration-200">Customer support</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-gray-300 hover:bg-[#E6F7F0] hover:text-[#009959] hover:border-[#009959] hover:scale-105 transition-all duration-200">Receptionist</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-gray-300 hover:bg-[#E6F7F0] hover:text-[#009959] hover:border-[#009959] hover:scale-105 transition-all duration-200">Lead generation</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-gray-300 hover:bg-[#E6F7F0] hover:text-[#009959] hover:border-[#009959] hover:scale-105 transition-all duration-200">Outbound sales</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-gray-300 hover:bg-[#E6F7F0] hover:text-[#009959] hover:border-[#009959] hover:scale-105 transition-all duration-200">Rental service</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-gray-300 hover:bg-[#E6F7F0] hover:text-[#009959] hover:border-[#009959] hover:scale-105 transition-all duration-200">Appointment booking</Badge>
              <Badge variant="outline" className="py-2 px-3 cursor-pointer rounded-full border-gray-300 hover:bg-[#E6F7F0] hover:text-[#009959] hover:border-[#009959] hover:scale-105 transition-all duration-200">Product recommendation</Badge>
            </div>
          </div>
        </div>

        {/* Recent section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Recent</h3>
          <Card className="rounded-xl border-0 bg-[#F5E6F3] hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="bg-[#491344] p-3 rounded-xl">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <h4 className="font-medium text-[#22262A]">Sales Prospector (Phone)</h4>
                  <p className="text-sm text-gray-600">Last used 7 days ago</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Templates section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Templates</h3>
          <div className="flex gap-4 overflow-x-auto py-4 px-2">
            {/* Template 1 - Shamrock Green */}
            <Card className="bg-[#009959] border-0 rounded-2xl hover:scale-105 hover:shadow-2xl transition-all duration-200 cursor-pointer overflow-hidden h-[360px] w-[240px] flex-shrink-0 flex flex-col">
              <CardHeader className="pb-4 pt-6 flex-grow">
                <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-lg text-white mb-3">Basic template</CardTitle>
                <CardDescription className="text-sm text-white/90 leading-relaxed">
                  Get up and running quickly with an AI that can answer questions about your business
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Template 2 - Cinnabar (Orange) */}
            <Card className="bg-[#F45A10] border-0 rounded-2xl hover:scale-105 hover:shadow-2xl transition-all duration-200 cursor-pointer overflow-hidden h-[360px] w-[240px] flex-shrink-0 flex flex-col">
              <CardHeader className="pb-4 pt-6 flex-grow">
                <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                  <MessageSquare className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-lg text-white mb-3">Customer support</CardTitle>
                <CardDescription className="text-sm text-white/90 leading-relaxed">
                  Handle customer inquiries with an AI that can respond to common questions and issues
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Template 3 - Mint Green (Light Blue) */}
            <Card className="bg-[#CBF3FC] border-0 rounded-2xl hover:scale-105 hover:shadow-2xl transition-all duration-200 cursor-pointer overflow-hidden h-[360px] w-[240px] flex-shrink-0 flex flex-col">
              <CardHeader className="pb-4 pt-6 flex-grow">
                <div className="h-16 w-16 bg-[#222E50]/10 rounded-2xl flex items-center justify-center mb-6">
                  <LayoutGrid className="h-8 w-8 text-[#222E50]" />
                </div>
                <CardTitle className="text-lg text-[#222E50] mb-3">Lead qualification</CardTitle>
                <CardDescription className="text-sm text-[#222E50]/80 leading-relaxed">
                  Qualify leads by asking questions and routing them to the right team members
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Template 4 - Saffron (Yellow) */}
            <Card className="bg-[#F9C116] border-0 rounded-2xl hover:scale-105 hover:shadow-2xl transition-all duration-200 cursor-pointer overflow-hidden h-[360px] w-[240px] flex-shrink-0 flex flex-col">
              <CardHeader className="pb-4 pt-6 flex-grow">
                <div className="h-16 w-16 bg-[#22262A]/10 rounded-2xl flex items-center justify-center mb-6">
                  <Calendar className="h-8 w-8 text-[#22262A]" />
                </div>
                <CardTitle className="text-lg text-[#22262A] mb-3">Appointment scheduler</CardTitle>
                <CardDescription className="text-sm text-[#22262A]/80 leading-relaxed">
                  Book, update, reschedule, or cancel appointments for your business
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Template 5 - Palatinate (Purple) */}
            <Card className="bg-[#491344] border-0 rounded-2xl hover:scale-105 hover:shadow-2xl transition-all duration-200 cursor-pointer overflow-hidden h-[360px] w-[240px] flex-shrink-0 flex flex-col">
              <CardHeader className="pb-4 pt-6 flex-grow">
                <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                  <HeadphonesIcon className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-lg text-white mb-3">IVR collector</CardTitle>
                <CardDescription className="text-sm text-white/90 leading-relaxed">
                  Collect information from callers with a voice-based interactive system
                </CardDescription>
              </CardHeader>
            </Card>

            {/* More Button */}
            <Card className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl hover:bg-gray-200 hover:border-gray-400 transition-all duration-200 cursor-pointer h-[360px] w-[240px] flex-shrink-0 flex items-center justify-center">
              <div className="text-center">
                <div className="h-16 w-16 bg-gray-200 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Plus className="h-8 w-8 text-gray-600" />
                </div>
                <p className="text-lg font-medium text-gray-700">View More</p>
                <p className="text-sm text-gray-500 mt-1">Explore templates</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Tutorials section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Tutorials</h3>
          <div className="relative bg-[#222E50] rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer">
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors duration-200">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" fill="white"/>
                </svg>
              </div>
            </div>
            <div className="h-48 bg-gradient-to-br from-[#222E50] to-[#009959]/20"></div>
            <div className="absolute bottom-0 left-0 p-6 text-white">
              <h4 className="font-semibold text-lg">Building an Agent</h4>
              <p className="text-sm text-white/80">1:43</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
