"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    // Route through /auth/confirm so the PKCE code exchange happens before
    // the user lands on the update-password page with an active session
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/update-password`,
    });

    setIsLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <div className="rounded-lg border border-border bg-surface-raised p-6">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold text-text-primary">
              Check your email
            </h1>
            <p className="text-sm text-text-secondary">
              Password reset instructions sent
            </p>
          </div>
          <p className="text-sm text-text-secondary">
            If an account with that email exists, you&apos;ll receive a password
            reset link shortly.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface-raised p-6">
          <div className="mb-4">
            <h1 className="text-2xl font-semibold text-text-primary">
              Reset your password
            </h1>
            <p className="text-sm text-text-secondary">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>
          <form onSubmit={handleForgotPassword}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-red-500">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                {isLoading ? "Sending…" : "Send reset email"}
              </button>
            </div>
            <div className="mt-4 text-center text-sm">
              Remember your password?{" "}
              <Link
                href="/auth/login"
                className="underline underline-offset-4"
              >
                Log in
              </Link>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
