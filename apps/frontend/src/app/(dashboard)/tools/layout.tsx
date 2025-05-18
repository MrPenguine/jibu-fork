import { Metadata } from 'next';

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
      {children}
    </div>
  );
}
