import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card"
import Link from "next/link"

export default async function LoginErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>
}) {
  const params = await searchParams
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason
  const isWorkspaceResolutionError = reason === 'workspace-resolution'

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {isWorkspaceResolutionError ? 'Workspace unavailable' : 'Authentication Error'}
          </CardTitle>
          <CardDescription>
            We encountered an issue with your authentication request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {isWorkspaceResolutionError
              ? "We couldn't load your workspace. Please try again, and contact support if the problem continues."
              : 'This could be due to an expired or invalid authentication link, or another issue with your account.'}
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
