export function EnvVarWarning() {
  return (
    <div className="flex gap-4 items-center">
      <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-normal">
        Supabase environment variables required
      </span>
      <div className="flex gap-2">
        <button
          className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium opacity-50 cursor-not-allowed"
          disabled
        >
          Sign in
        </button>
        <button
          className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-medium opacity-50 cursor-not-allowed"
          disabled
        >
          Sign up
        </button>
      </div>
    </div>
  );
}
