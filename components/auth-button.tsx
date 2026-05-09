import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-4">
      Hey, {user.email}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Link
        href="/auth/login"
        className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-raised"
      >
        Sign in
      </Link>
      <Link
        href="/auth/sign-up"
        className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-foreground/90"
      >
        Sign up
      </Link>
    </div>
  );
}
