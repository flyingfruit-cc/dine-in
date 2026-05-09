export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 lg:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-border bg-surface-raised p-6">
            <div className="mb-4">
              <h1 className="text-2xl font-semibold text-text-primary">
                Thank you for signing up!
              </h1>
              <p className="text-sm text-text-secondary">Check your email to confirm</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">
                You&apos;ve successfully signed up. Please check your email to
                confirm your account before signing in.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
