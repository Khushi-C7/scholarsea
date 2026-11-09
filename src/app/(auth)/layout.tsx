import { Brand } from "@/components/layout/brand";

/** Minimal centered layout for the login / signup pages (no app shell). */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6">
        <Brand />
      </div>
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        {children}
      </div>
      <p className="mt-6 max-w-sm text-center text-xs text-muted-foreground">
        ScholarSea — an AI research intelligence workspace.
      </p>
    </div>
  );
}
