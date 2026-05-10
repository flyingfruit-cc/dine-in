"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createRestaurant } from "@/actions/authActions";
import { isValidSlugFormat } from "@/utils/validateSlug";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const doSignUp = async () => {
    setIsLoading(true);
    setFormError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/auth/onboarding`,
      },
    });

    setIsLoading(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    if (!data.session) {
      // Email confirmation required — session is null until user confirms
      setStep(3);
      return;
    }
    // Autoconfirm ON — session active immediately, proceed to restaurant setup
    setStep(2);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    await doSignUp();
  };

  const handleSlugBlur = () => {
    if (slug && !isValidSlugFormat(slug)) {
      setSlugError("Slug must be 3–50 lowercase letters, numbers, or hyphens");
    } else {
      setSlugError(null);
    }
  };

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidSlugFormat(slug)) {
      setSlugError("Slug must be 3–50 lowercase letters, numbers, or hyphens");
      return;
    }
    setIsLoading(true);
    setFormError(null);
    setSlugError(null);

    const result = await createRestaurant({ name: restaurantName, slug });

    setIsLoading(false);
    if (!result.success) {
      if (result.code === "SLUG_TAKEN" || result.code === "SLUG_INVALID") {
        setSlugError(result.error);
      } else {
        setFormError(result.error);
      }
      return;
    }
    router.push("/admin");
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="rounded-lg border border-border bg-surface-raised p-6">
        {step === 1 && (
          <>
            <div className="mb-4">
              <h1 className="text-2xl font-semibold text-text-primary">
                Create account
              </h1>
              <p className="text-sm text-text-secondary">
                Enter your email and a password to get started
              </p>
            </div>
            <form onSubmit={handleSignUp}>
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
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                {formError && (
                  <p role="alert" className="text-sm text-red-500">
                    {formError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                >
                  {isLoading ? "Creating account…" : "Continue"}
                </button>
              </div>
              <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  Log in
                </Link>
              </div>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <div className="mb-4">
              <h1 className="text-2xl font-semibold text-text-primary">
                Set up your restaurant
              </h1>
              <p className="text-sm text-text-secondary">
                Your restaurant name and a unique URL for customers
              </p>
            </div>
            <form onSubmit={handleCreateRestaurant}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <label
                    htmlFor="restaurant-name"
                    className="text-sm font-medium"
                  >
                    Restaurant name
                  </label>
                  <input
                    id="restaurant-name"
                    type="text"
                    placeholder="The Blue Plate"
                    required
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="slug" className="text-sm font-medium">
                    URL slug
                  </label>
                  <div className="flex h-10 w-full items-center rounded-md border border-border bg-transparent text-sm">
                    <span className="px-3 text-text-tertiary">dine-in/</span>
                    <input
                      id="slug"
                      type="text"
                      placeholder="blue-plate"
                      required
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value.toLowerCase());
                        setSlugError(null);
                      }}
                      onBlur={handleSlugBlur}
                      className="flex-1 bg-transparent pr-3 focus:outline-none"
                    />
                  </div>
                  {slugError && (
                    <p role="alert" className="text-sm text-red-500">
                      {slugError}
                    </p>
                  )}
                </div>
                {formError && (
                  <p role="alert" className="text-sm text-red-500">
                    {formError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                >
                  {isLoading ? "Creating restaurant…" : "Go to dashboard"}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
                aria-hidden="true"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-text-primary">
                Check your email
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                We sent a confirmation link to
              </p>
              <p className="mt-0.5 text-sm font-medium text-text-primary">
                {email}
              </p>
            </div>
            <p className="max-w-xs text-sm text-text-secondary">
              Click the link in the email to confirm your account. After
              confirming, you&apos;ll be taken to finish setting up your
              restaurant.
            </p>
            <p className="text-xs text-text-tertiary">
              No email?{" "}
              <button
                type="button"
                onClick={doSignUp}
                className="underline underline-offset-4 hover:text-text-secondary"
              >
                Resend
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
