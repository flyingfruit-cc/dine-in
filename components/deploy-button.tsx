import Link from "next/link";

export function DeployButton() {
  return (
    <Link
      href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Ftree%2Fcanary%2Fexamples%2Fwith-supabase&project-name=nextjs-with-supabase&repository-name=nextjs-with-supabase"
      target="_blank"
      className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-foreground/90"
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 76 65"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="inherit" />
      </svg>
      <span>Deploy to Vercel</span>
    </Link>
  );
}
