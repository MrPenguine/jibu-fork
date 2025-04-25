import { AppSidebar } from "@libs/shadcn-ui/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@libs/shadcn-ui/components/ui/breadcrumb"
import { Separator } from "@libs/shadcn-ui/components/ui/separator"
import {
  SidebarInset,
  SidebarTrigger,
} from "@libs/shadcn-ui/components/ui/sidebar"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { createClient } from "../../utils/supabase/server"
import { redirect } from "next/navigation"
import { logout } from "../auth/actions"
import UserProfile from "../../components/UserProfile"
import OrganizationList from "../../components/OrganizationList"

export default async function Page() {
  // Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If not authenticated, redirect to login
  if (!user) {
    redirect("/login")
  }

  return (
    <>
      <AppSidebar />
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <h1 className="text-2xl font-bold mb-4">Welcome, {user.email}</h1>
            </div>
            
            {/* User Profile Card */}
            <div className="rounded-xl border bg-card text-card-foreground shadow">
              <div className="p-6">
                <UserProfile />
              </div>
            </div>
            
            {/* Organizations Card */}
            <div className="rounded-xl border bg-card text-card-foreground shadow">
              <div className="p-6">
                <OrganizationList />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </>
  )
}