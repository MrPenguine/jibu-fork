'use client'

import { Button } from "@libs/shadcn-ui/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card"
import Link from "next/link"

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authentication Error</CardTitle>
          <CardDescription>
            We encountered an issue with your authentication request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This could be due to an expired or invalid authentication link, or another issue with your account.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/">Return to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 