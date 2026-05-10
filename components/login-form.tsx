"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setIsLoading(false);
    if (error) {
      const isAuthError =
        error.code === "invalid_credentials" ||
        error.message === "Invalid login credentials";
      setError(
        isAuthError
          ? "Incorrect email or password — tap to try again"
          : "Something went wrong. Please try again."
      );
      return;
    }
    router.push("/admin");
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="rounded-lg border border-border bg-surface-raised p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-text-primary">Log in</h1>
          <p className="text-sm text-text-secondary">
            Enter your email and password to access your dashboard
          </p>
        </div>
        <form onSubmit={handleLogin}>
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
            <div className="grid gap-2">
              <div className="flex items-center">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
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
              {isLoading ? "Logging in…" : "Log in"}
            </button>
          </div>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/auth/sign-up" className="underline underline-offset-4">
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
