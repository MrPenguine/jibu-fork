import './global.css';
import { Inter, Red_Hat_Display } from 'next/font/google';
import { SidebarProvider } from "@libs/shadcn-ui/components/ui/sidebar"
import { ApiProvider } from "../utils/apiContext"

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const redHatDisplay = Red_Hat_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

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
    <html lang="en" className={`${inter.variable} ${redHatDisplay.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <SidebarProvider>
          <ApiProvider>
            {children}
          </ApiProvider>
        </SidebarProvider>
      </body>
    </html>
  );
}
