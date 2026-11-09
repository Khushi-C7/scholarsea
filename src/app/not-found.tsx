import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/brand";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <BrandMark className="size-10" />
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">
          404 — Page not found
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn&apos;t find that page
        </h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          The page may have moved, or the link may be incorrect.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to dashboard</Link>
      </Button>
    </main>
  );
}
