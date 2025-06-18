import { Metadata } from 'next';
import { Wrench } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Tools - Jibu Console',
  description: 'Manage and configure tools for your Jibu assistants',
};

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center gap-2 mb-2">
        <Wrench className="h-5 w-5 text-gray-500" />
        <span className="text-sm text-gray-500 font-medium">Tools</span>
      </div>
      {children}
    </div>
  );
}
