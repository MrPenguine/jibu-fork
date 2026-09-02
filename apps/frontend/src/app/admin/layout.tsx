"use client"

import * as React from "react"
import { SidebarProvider } from "@libs/shadcn-ui/components/ui/sidebar"
import { PlatformAdminSidebar } from "../../../../../libs/shadcn-ui/src/components/admin/PlatformAdminSidebar"
import { SidebarInset } from "@libs/shadcn-ui/components/ui/sidebar"
import { Toaster } from "@libs/shadcn-ui/components/ui/toaster"
import { usePathname, useRouter } from "next/navigation"
import { useMemo, useEffect, useState } from "react"
import { Shield } from "lucide-react"
import { logout } from "../../utils/auth/actions"
import { useApi } from "../../utils/apiContext"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: apiLoading, isPlatformAdmin } = useApi();
  const [userInfo, setUserInfo] = useState<{ name: string; email: string; avatar: string; isPlatformAdmin: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get current page title from pathname
  const pageTitle = useMemo(() => {
    if (!pathname) return 'Cockpit View';

    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'Cockpit View';

    const lastPart = parts[parts.length - 1];
    if (!lastPart) return 'Cockpit View';
    
    if (lastPart === 'admin') return 'Cockpit View';
    if (lastPart === 'credentials') return 'Platform Credentials';
    if (lastPart === 'system-checks') return 'System Checks';
    if (lastPart === 'logs') return 'System Logs & Monitoring';
    if (lastPart === 'billing') return 'Billing & Finance';
    
    // Format the title (capitalize, replace hyphens with spaces)
    return lastPart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, [pathname]);

  // Check if user is platform admin
  useEffect(() => {
    let mounted = true;

    const checkAdminAccess = () => {
      if (!mounted) return;

      // Wait for API context to finish loading
      if (apiLoading) return;

      // If there is no authenticated user, send to login
      if (!user) {
        setIsLoading(false);
        router.push('/login');
        return;
      }

      const ctx: any = user || {};
      const name =
        ctx.fullName ||
        (ctx.firstName && ctx.lastName
          ? `${ctx.firstName} ${ctx.lastName}`
          : ctx.firstName) ||
        ctx.email ||
        'Admin';
      const avatar = ctx.imageUrl || ctx.avatar || '';
      const email = ctx.email || '';

      setUserInfo({ name, email, avatar, isPlatformAdmin });

      if (!isPlatformAdmin) {
        setIsLoading(false);
        router.push('/');
        return;
      }

      setIsLoading(false);
    };

    checkAdminAccess();

    return () => {
      mounted = false;
    };
  }, [router, user, apiLoading, isPlatformAdmin]);

  const handleLogout = () => {
    logout();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Shield className="h-12 w-12 text-violet-600 mx-auto mb-4 animate-pulse" />
          <p className="text-sm text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-full flex-row overflow-hidden">
      <SidebarProvider>
        <PlatformAdminSidebar 
          userInfo={userInfo} 
          onLogout={handleLogout}
        />
        <SidebarInset className="bg-white flex-1 flex flex-col overflow-hidden">
          <header className="flex h-16 w-full shrink-0 items-center gap-2 px-6 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100">
                <Shield className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
                <p className="text-xs text-gray-500">Platform Administration</p>
              </div>
            </div>
          </header>
          <main className="flex-1 w-full overflow-y-auto bg-gray-50">
            {children}
          </main>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </div>
  );
}
