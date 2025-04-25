import { Button } from '@libs/shadcn-ui'
import { createClient } from "../../utils/supabase/server"
import { redirect } from "next/navigation"
import { logout } from "../auth/actions"

export default async function DashboardPage() {
  // Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If not authenticated, redirect to login
  if (!user) {
    redirect("/login")
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="bg-card p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Welcome, {user.email}</h2>
        <p className="text-muted-foreground mb-6">You are now signed in to your Jibu AI account.</p>
        <form action={logout}>
          <Button variant="outline" className="w-full sm:w-auto" type="submit">
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  )
} 