import './global.css';
import { SidebarProvider } from "@libs/shadcn-ui/components/ui/sidebar"
import { OrganizationProvider } from "../utils/organizationContext"

export const metadata = {
  title: 'Jibu AI Console',
  description: 'Jibu AI Console Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <SidebarProvider>
          <OrganizationProvider>
            {children}
          </OrganizationProvider>
        </SidebarProvider>
      </body>
    </html>
  );
}
