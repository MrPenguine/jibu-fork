'use client'

import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function LoginErrorPage() {
  const searchParams = useSearchParams()
  const isWorkspaceResolutionError =
    searchParams.get("reason") === "workspace-resolution"

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {isWorkspaceResolutionError
              ? "Workspace unavailable"
              : "Authentication Error"}
          </CardTitle>
          <CardDescription>
            {isWorkspaceResolutionError
              ? "We couldn't load your workspace after signing in."
              : "We encountered an issue with your authentication request."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {isWorkspaceResolutionError
              ? "The backend may be unavailable or your workspace could not be resolved. Please try again shortly."
              : "This could be due to an expired or invalid authentication link, or another issue with your account."}
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/login">Return to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
