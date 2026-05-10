"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setIsLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="rounded-lg border border-border bg-surface-raised p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-text-primary">
            Set new password
          </h1>
          <p className="text-sm text-text-secondary">
            Enter your new password below
          </p>
        </div>
        <form onSubmit={handleUpdatePassword}>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                New password
              </label>
              <input
                id="password"
                type="password"
                placeholder="New password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {isLoading ? "Saving…" : "Save new password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
