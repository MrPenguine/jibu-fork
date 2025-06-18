'use client';

import { GoogleCalendarCard } from '@libs/shadcn-ui/src/components/tools/google-calendar/GoogleCalendarCard';
import { Button } from '@libs/shadcn-ui/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@libs/shadcn-ui/src/components/ui/card';
import { ArrowLeft, CalendarIcon, CalendarPlus, CheckCircle2, CalendarCheck, Users } from 'lucide-react';
import Link from 'next/link';

export default function GoogleCalendarToolPage() {
  return (
    <div className="py-2">
      <div className="flex items-center mb-6">
        <Link href="/tools" className="mr-4">
          <Button variant="outline" size="icon" className="rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-cyan-500" />
            Google Calendar
          </h1>
          <p className="text-gray-500">Connect and manage your Google Calendar integration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GoogleCalendarCard />
        </div>
        
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Google Calendar Features</CardTitle>
              <CardDescription>What you can do with this integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <CalendarCheck className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Check Availability</h3>
                  <p className="text-sm text-gray-500">View your calendar availability for scheduling</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <CalendarPlus className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Create Events</h3>
                  <p className="text-sm text-gray-500">Schedule new events directly from Jibu</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Users className="h-5 w-5 text-violet-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Manage Attendees</h3>
                  <p className="text-sm text-gray-500">Add attendees to your calendar events</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>How to use Google Calendar with Jibu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-gray-700 font-medium text-xs">1</div>
                <div>
                  <p className="text-sm">Connect your Google Calendar account</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-gray-700 font-medium text-xs">2</div>
                <div>
                  <p className="text-sm">Create events directly from the interface</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-gray-700 font-medium text-xs">3</div>
                <div>
                  <p className="text-sm">Use the calendar in your assistants</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
