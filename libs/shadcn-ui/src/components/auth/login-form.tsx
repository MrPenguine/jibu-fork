"use client"
import { useState, useTransition } from "react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

type FormMode = "login" | "signup" | "forgot-password"

export function LoginForm({
  className,
  defaultMode,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { defaultMode?: FormMode }) {
  const [mode, setMode] = useState<FormMode>(defaultMode ?? "login")
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

  const isLoading = isPending || isLoggingIn

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
        
        // If login is successful, resolve workspace and redirect
        if (mode === "login") {
          setIsLoggingIn(true)
          try {
            // 1) Try to get workspace from storage first (fast path)
            let workspaceId: string | null = null
            try {
              workspaceId =
                localStorage.getItem("activeOrganizationId") ||
                sessionStorage.getItem("activeOrganizationId")
            } catch (_) {
              // ignore storage errors (e.g., disabled storage)
            }

            // 2) If not found, fetch last organization from server
            if (!workspaceId) {
              const orgRes = await fetch("/api/auth/get-user-org", { method: "GET" })
              if (orgRes.ok) {
                const orgData = await orgRes.json()
                workspaceId = orgData?.organization?.id ?? null
                if (workspaceId) {
                  try {
                    localStorage.setItem("activeOrganizationId", workspaceId)
                    sessionStorage.setItem("activeOrganizationId", workspaceId)
                  } catch (_) {
                    // ignore storage errors
                  }
                }
              }
            }

            // 3) Navigate
            if (workspaceId) {
              router.push(`/workspace/${workspaceId}`)
            } else {
              // Fallback if no organization found
              router.push("/")
            }
          } catch (e) {
            console.error("Post-login redirect failed:", e)
            router.push("/")
          } finally {
            router.refresh()
          }
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
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-center text-sm font-medium">Logging in...</p>
          <p className="text-center text-xs text-muted-foreground mt-1">Fetching your organization</p>
        </div>
      )}
      
      <Card className="border-none rounded-2xl shadow-sm">
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
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-500">
                  {error}
                </div>
              )}
              
              {mode !== "forgot-password" && (
                <div className="flex flex-col gap-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full rounded-xl" 
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
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
                  <div className="grid gap-1">
                    <Label className="ml-1 text-sm font-medium dark:text-gray-400" htmlFor="email">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      required
                      className="rounded-xl"
                      disabled={isLoading}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  
                  {mode !== "forgot-password" && (
                    <div className="grid gap-1">
                      <div className="flex items-center">
                        <Label className="ml-1 text-sm font-medium dark:text-gray-400" htmlFor="password">
                          Password
                        </Label>
                        {mode === "login" && (
                          <button
                            type="button"
                            onClick={() => setMode("forgot-password")}
                            className="ml-auto text-xs text-primary underline-offset-4 hover:underline"
                            disabled={isLoading}
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <Input 
                        id="password" 
                        type="password"
                        placeholder="••••••••" 
                        required
                        className="rounded-xl" 
                        disabled={isLoading}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  )}
                  
                  <Button 
                    type="submit" 
                    className="w-full mt-2 rounded-xl" 
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {buttonTexts[mode]}
                  </Button>
                </div>
              </div>
              
              {mode !== "forgot-password" && (
                <div className="text-center text-sm">
                  {mode === "login" ? (
                    <>
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => router.push("/signup")}
                        className="text-primary underline underline-offset-4"
                        disabled={isLoading}
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => router.push("/login")}
                        className="text-primary underline underline-offset-4"
                        disabled={isLoading}
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
                    onClick={() => router.push("/login")}
                    className="text-primary underline underline-offset-4"
                    disabled={isLoading}
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
