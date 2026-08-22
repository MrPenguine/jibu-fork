"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card"
import { fetchAPI } from "../../../utils/api"
import { authClient } from "../../../utils/auth/client"

interface Invitation {
  id: string
  token: string
  workspace: {
    id: string
    name: string
  }
  role: string
  email: string
  expiresAt: string
}

export default function InvitationPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const session = authClient.useSession()
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (session.isPending || !params.id) return
    if (!session.data?.user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/invite/${params.id}`)}`)
      return
    }

    fetchAPI(`/v1/invitations/public/${params.id}`)
      .then((data: Invitation) => setInvitation(data))
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : "Unable to load this invitation")
      })
  }, [params.id, router, session.data?.user, session.isPending])

  const respond = async (action: "accept" | "reject") => {
    if (!invitation) return
    setIsSubmitting(true)
    setError(null)
    try {
      await fetchAPI(`/workspaces/invitations/${invitation.id}/respond`, {
        method: "POST",
        body: JSON.stringify({ action, token: invitation.token }),
      })
      router.push(action === "accept" ? `/workspace/${invitation.workspace.id}` : "/")
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to respond to this invitation")
      setIsSubmitting(false)
    }
  }

  if (session.isPending || (!invitation && !error)) {
    return <div className="flex min-h-svh items-center justify-center p-4">Loading invitation...</div>
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{error ? "Invitation unavailable" : `Join ${invitation?.workspace.name}`}</CardTitle>
          <CardDescription>
            {error || `You have been invited to join this workspace as a ${invitation?.role}.`}
          </CardDescription>
        </CardHeader>
        {invitation && !error && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This invitation was sent to {invitation.email}.
            </p>
          </CardContent>
        )}
        <CardFooter className="gap-2">
          {invitation && !error ? (
            <>
              <Button variant="outline" onClick={() => respond("reject")} disabled={isSubmitting}>
                Decline
              </Button>
              <Button onClick={() => respond("accept")} disabled={isSubmitting}>
                Accept & Join
              </Button>
            </>
          ) : (
            <Button className="w-full" onClick={() => router.push("/login")}>
              Return to Login
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
