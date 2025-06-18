// NOTE: Make sure to install zod, @hookform/resolvers, and react-hook-form in your frontend project.

"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Label } from "@libs/shadcn-ui/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@libs/shadcn-ui/components/ui/card";
import { useToast } from "@libs/shadcn-ui/components/ui/use-toast";
import { useApi } from "../../../../utils/apiContext";
import { createClient } from "../../../../utils/supabase/client";
import { useRouter } from "next/navigation";
import { logout } from "../../../auth/actions";

// --- Zod Schemas for Validation ---
const passwordFormSchema = z
  .object({
    newPassword: z.string().min(8, { message: "Password must be at least 8 characters." }),
    confirmPassword: z.string(),
  })
  .refine((data: { newPassword: string; confirmPassword: string }) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function ProfileSettingsPage() {
  const { user, apiRequest } = useApi();
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();

  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [confirmEmailInput, setConfirmEmailInput] = useState("");

  // --- Password Update Form ---
  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onPasswordSubmit(values: z.infer<typeof passwordFormSchema>) {
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      });
      if (error) {
        throw new Error(error.message);
      }
      toast({
        title: "Success",
        description: "Your password has been updated.",
      });
      passwordForm.reset();
    } catch (error: any) {
      toast({
        title: "Error Updating Password",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  // --- Account Deletion Logic ---
  async function handleDeleteAccount() {
    if (!user || confirmEmailInput !== user.email) {
      toast({
        title: "Confirmation Failed",
        description: "Please type your email correctly to confirm deletion.",
        variant: "destructive",
      });
      return;
    }
    setIsDeletingAccount(true);
    try {
      await apiRequest("/users/me", { method: "DELETE" });
      toast({
        title: "Account Deletion Initiated",
        description: "Your account is scheduled for deletion. You will be logged out.",
      });
      await logout(new FormData());
      router.push("/login");
    } catch (error: any) {
      toast({
        title: "Error Deleting Account",
        description: error.message || "Could not delete account. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAccount(false);
    }
  }
  if (!user) {
    return <div>Could not load user details. Please try logging in again.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-3xl">
      <h1 className="text-2xl font-semibold">Account</h1>
      {/* --- Account Settings Card --- */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Customize your account details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Display Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={user.email} readOnly disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed directly here. Contact support if needed.
            </p>
          </div>
          {/* Update Password Form */}
          {/* @ts-ignore: Form may be a custom wrapper, adjust import if needed */}
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input type="password" id="newPassword" {...passwordForm.register("newPassword")}/>
              {passwordForm.formState.errors.newPassword && (
                <p className="text-destructive text-xs">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input type="password" id="confirmPassword" {...passwordForm.register("confirmPassword")}/>
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-destructive text-xs">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" disabled={isUpdatingPassword}>
              {isUpdatingPassword ? "Updating..." : "Update New Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {/* --- Delete Account Card --- */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>
            Permanently remove your account and all its contents. Upon deletion of your account, any orgs
            without any members will be deleted immediately. Neither the account, nor the orgs will be
            recoverable. Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirmEmail">
              To confirm, please type your email address: <span className="font-medium">{user.email}</span>
            </Label>
            <Input
              id="confirmEmail"
              type="email"
              placeholder="Enter your email"
              value={confirmEmailInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmEmailInput(e.target.value)}
              className={confirmEmailInput && confirmEmailInput !== user.email ? "border-destructive focus-visible:ring-destructive" : ""}
            />
          </div>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={isDeletingAccount || confirmEmailInput !== user.email}
          >
            {isDeletingAccount ? "Deleting..." : "Delete Account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 