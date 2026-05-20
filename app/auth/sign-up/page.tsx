import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { SignUpForm } from "@/components/sign-up-form";

export default async function Page() {
  let isAuthenticated = false;
  if (hasEnvVars) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      isAuthenticated = !!data?.claims;
    } catch (err) {
      console.error("[auth/sign-up] session check failed:", err);
    }
  }
  if (isAuthenticated) redirect("/admin");

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 lg:p-10">
      <div className="w-full max-w-sm">
        <SignUpForm />
      </div>
    </div>
  );
}
