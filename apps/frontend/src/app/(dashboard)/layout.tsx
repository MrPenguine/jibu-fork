import { SidebarProvider } from "@libs/shadcn-ui/components/ui/sidebar"
import { CustomAppSidebar } from "../../../../../libs/shadcn-ui/src/components/CustomAppSidebar"
import { SidebarInset, SidebarTrigger } from "@libs/shadcn-ui/components/ui/sidebar"
import { Separator } from "@libs/shadcn-ui/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@libs/shadcn-ui/components/ui/breadcrumb"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { logout } from "../auth/actions"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SidebarProvider>
        <CustomAppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-none">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">
                      Dashboard
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Overview</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="ml-auto mr-4">
              <form action={logout}>
                <Button variant="outline" className="w-full sm:w-auto" type="submit">
                  Sign Out
                </Button>
              </form>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
} 