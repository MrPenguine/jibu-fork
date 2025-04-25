import { SidebarProvider } from "@libs/shadcn-ui/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SidebarProvider>
        {children}
      </SidebarProvider>
    </div>
  )
} 