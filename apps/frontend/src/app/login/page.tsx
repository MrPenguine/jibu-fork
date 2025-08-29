"use client"
import { LoginForm } from "@libs/shadcn-ui/components/auth/login-form"
import Image from "next/image"

export default function LoginPage() {
  return (
    <div className="grid min-h-svh w-full place-items-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm space-y-0">
        <div className="flex justify-center mb-[-16px]">
          <Image
            src="/logo-light.svg"
            alt="Jibu AI Logo"
            width={240}
            height={80}
            priority
          />
        </div>
        <LoginForm defaultMode="login" />
      </div>
    </div>
  )
}