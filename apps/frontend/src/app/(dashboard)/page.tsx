import { createClient } from "../../utils/supabase/server"
import { redirect } from "next/navigation"
import UserProfile from "../../../../../libs/shadcn-ui/src/components/UserProfile"
import OrganizationList from "../../../../../libs/shadcn-ui/src/components/OrganizationList"
import CurrentOrganization from "../../../../../libs/shadcn-ui/src/components/CurrentOrganization"

export default async function Page() {
  // Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If not authenticated, redirect to login
  if (!user) {
    redirect("/login")
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <h1 className="text-2xl font-bold mb-4">Welcome, {user.email}</h1>
      </div>
      
      {/* Current Organization Card */}
      <div className="rounded-xl border bg-card text-card-foreground shadow">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Current Organization</h2>
          <CurrentOrganization />
        </div>
      </div>
      
      {/* User Profile Card */}
      <div className="rounded-xl border bg-card text-card-foreground shadow">
        <div className="p-6">
          <UserProfile />
        </div>
      </div>
      
      {/* Organizations Card */}
      <div className="md:col-span-2 rounded-xl border bg-card text-card-foreground shadow">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">My Organizations</h2>
          <OrganizationList />
        </div>
      </div>
    </div>
  )
}