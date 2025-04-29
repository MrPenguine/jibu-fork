"use client"
import { useState, useTransition } from "react"
import { cn } from "../lib/utils"
import { Button } from "@libs/shadcn-ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@libs/shadcn-ui/components/ui/card"
import { Input } from "@libs/shadcn-ui/components/ui/input"
import { Label } from "@libs/shadcn-ui/components/ui/label"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

type FormMode = "login" | "signup" | "forgot-password"

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [mode, setMode] = useState<FormMode>("login")
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const router = useRouter()

  const titles = {
    "login": "Welcome back",
    "signup": "Create an account",
    "forgot-password": "Reset your password"
  }

  const descriptions = {
    "login": "Login to your Jibu AI account",
    "signup": "Sign up for a Jibu AI account",
    "forgot-password": "Enter your email to receive a reset link"
  }

  const buttonTexts = {
    "login": "Login",
    "signup": "Sign up",
    "forgot-password": "Send reset link"
  }

  const googleButtonTexts = {
    "login": "Login with Google",
    "signup": "Sign up with Google",
    "forgot-password": "Login with Google"
  }

  const handleGoogleSignIn = () => {
    startTransition(async () => {
      try {
        setError(null)
        
        const formData = new FormData()
        formData.append("provider", "google")
        
        const response = await fetch("/api/auth/oauth", {
          method: "POST",
          body: formData,
        })
        
        const data = await response.json()
        
        if (data.error) {
          setError(data.error)
          return
        }
        
        if (data.url) {
          window.location.href = data.url
        }
      } catch (err) {
        setError("An error occurred with Google sign in")
        console.error(err)
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    startTransition(async () => {
      try {
        setError(null)
        
        const formData = new FormData()
        formData.append("email", email)
        formData.append("password", password)
        
        let endpoint = "/api/auth/"
        
        switch (mode) {
          case "login":
            endpoint += "login"
            break
          case "signup":
            endpoint += "signup"
            break
          case "forgot-password":
            endpoint += "reset-password"
            break
        }
        
        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
        })
        
        const data = await response.json()
        
        if (data.error) {
          setError(data.error)
          return
        }
        
        if (data.success) {
          if (mode === "forgot-password") {
            setError("Check your email for the reset link")
            setMode("login")
            return
          }
          
          if (mode === "signup") {
            setError("Check your email for the confirmation link")
            return
          }
        }
        
        // If login is successful, show loading state while fetching last organization
        if (mode === "login") {
          setIsLoggingIn(true)
          // We'll let the middleware/navigation handle the redirect
          // This gives time for the lastOrg processing to happen
          router.push("/")
          router.refresh()
        }
      } catch (err) {
        setError("An unexpected error occurred")
        console.error(err)
        setIsLoggingIn(false)
      }
    })
  }

  return (
    <div className={cn("flex flex-col gap-6 relative", className)} {...props}>
      {isLoggingIn && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-center text-sm font-medium">Logging in...</p>
          <p className="text-center text-xs text-muted-foreground mt-1">Fetching your organization</p>
        </div>
      )}
      
      <Card className="border-none">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{titles[mode]}</CardTitle>
          <CardDescription>
            {descriptions[mode]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">
                  {error}
                </div>
              )}
              
              {mode !== "forgot-password" && (
                <div className="flex flex-col gap-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleGoogleSignIn}
                    disabled={isPending || isLoggingIn}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
                      <path
                        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                        fill="currentColor"
                      />
                    </svg>
                    {googleButtonTexts[mode]}
                  </Button>
                </div>
              )}

              {mode !== "forgot-password" && (
                <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                  <span className="relative z-10 bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              )}
              
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    disabled={isPending || isLoggingIn}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                
                {mode !== "forgot-password" && (
                  <div className="grid gap-2">
                    <div className="flex items-center">
                      <Label htmlFor="password">Password</Label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => setMode("forgot-password")}
                          className="ml-auto text-sm underline-offset-4 hover:underline"
                          disabled={isPending || isLoggingIn}
                        >
                          Forgot your password?
                        </button>
                      )}
                    </div>
                    <Input 
                      id="password" 
                      type="password" 
                      required 
                      disabled={isPending || isLoggingIn}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                )}
                
                <Button type="submit" className="w-full" disabled={isPending || isLoggingIn}>
                  {isPending ? "Loading..." : buttonTexts[mode]}
                </Button>
              </div>
              
              {mode !== "forgot-password" && (
                <div className="text-center text-sm">
                  {mode === "login" ? (
                    <>
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("signup")}
                        className="underline underline-offset-4"
                        disabled={isPending || isLoggingIn}
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="underline underline-offset-4"
                        disabled={isPending || isLoggingIn}
                      >
                        Login
                      </button>
                    </>
                  )}
                </div>
              )}
              
              {mode === "forgot-password" && (
                <div className="text-center text-sm">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="underline underline-offset-4"
                    disabled={isPending || isLoggingIn}
                  >
                    Back to login
                  </button>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  )
}
