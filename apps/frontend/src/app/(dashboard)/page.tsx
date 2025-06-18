import { createClient } from "../../utils/supabase/server"
import { redirect } from "next/navigation"
import UserProfile from "../../../../../libs/shadcn-ui/src/components/user/UserProfile"
import OrganizationList from "../../../../../libs/shadcn-ui/src/components/organization/OrganizationList"
import CurrentOrganization from "../../../../../libs/shadcn-ui/src/components/organization/CurrentOrganization"
import { CustomCard, CustomCardContent } from "../../../../../libs/shadcn-ui/src/components/ui/custom-card"

export default async function Page() {
  // Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If not authenticated, redirect to login
  if (!user) {
    redirect("/login")
  }

  return (
    <div className="w-full p-6">
      <div className="max-w-[1600px] mx-auto">
        <h1 className="text-2xl font-bold mb-6">Welcome, {user.email}</h1>
        
        {/* Profile cards */}
        <div className="flex justify-center mb-8">
          <div className="w-full md:w-2/3">
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
              {/* Current Organization Card */}
              <CustomCard>
                <CustomCardContent>
                  <h2 className="text-xl font-semibold mb-4">Current Organization</h2>
                  <CurrentOrganization />
                </CustomCardContent>
              </CustomCard>
              
              {/* User Profile Card */}
              <CustomCard>
                <CustomCardContent>
                  <h2 className="text-xl font-semibold mb-4">User Profile</h2>
                  <UserProfile />
                </CustomCardContent>
              </CustomCard>
            </div>
          </div>
        </div>
        
        {/* Organizations Card */}
        <div className="flex justify-center">
          <div className="w-full md:w-2/3">
            <CustomCard>
              <CustomCardContent>
                <h2 className="text-xl font-semibold mb-4">My Organizations</h2>
                <OrganizationList />
              </CustomCardContent>
            </CustomCard>
          </div>
        </div>
      </div>
    </div>
  )
}