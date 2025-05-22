'use client';

import { GoogleSheetsCard } from '@libs/shadcn-ui/src/components/tools/google-sheets/GoogleSheetsCard';
import { Button } from '@libs/shadcn-ui/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@libs/shadcn-ui/src/components/ui/card';
import { ArrowLeft, FileSpreadsheet, FileText, Table, Users } from 'lucide-react';
import Link from 'next/link';

export default function GoogleSheetsToolPage() {
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
            <FileSpreadsheet className="h-6 w-6 text-green-500" />
            Google Sheets
          </h1>
          <p className="text-gray-500">Connect and manage your Google Sheets integration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GoogleSheetsCard />
        </div>
        
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Google Sheets Features</CardTitle>
              <CardDescription>What you can do with this integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <Table className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">View Spreadsheets</h3>
                  <p className="text-sm text-gray-500">Access your Google Sheets data</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Create Spreadsheets</h3>
                  <p className="text-sm text-gray-500">Create new spreadsheets directly from Jibu</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Users className="h-5 w-5 text-violet-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Collaborate</h3>
                  <p className="text-sm text-gray-500">Share and collaborate on spreadsheets</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>How to use Google Sheets with Jibu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-gray-700 font-medium text-xs">1</div>
                <div>
                  <p className="text-sm">Connect your Google Sheets account</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-gray-700 font-medium text-xs">2</div>
                <div>
                  <p className="text-sm">Create or access spreadsheets from the interface</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-gray-700 font-medium text-xs">3</div>
                <div>
                  <p className="text-sm">Use spreadsheet data in your assistants</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
