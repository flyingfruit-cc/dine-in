import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      {params?.error ? (
        <p className="text-sm text-text-secondary">
          Code error: {params.error}
        </p>
      ) : (
        <p className="text-sm text-text-secondary">
          An unspecified error occurred.
        </p>
      )}
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 lg:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-border bg-surface-raised p-6">
            <div className="mb-4">
              <h1 className="text-2xl font-semibold text-text-primary">
                Sorry, something went wrong.
              </h1>
            </div>
            <div>
              <Suspense>
                <ErrorContent searchParams={searchParams} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
