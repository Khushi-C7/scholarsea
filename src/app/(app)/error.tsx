"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { PageContainer } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Route-level error boundary for the workspace. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A real logger is wired in a later step; for now surface it in dev.
    console.error(error);
  }, [error]);

  return (
    <PageContainer>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-5 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-[color:var(--destructive)]">
            <TriangleAlert className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold">Something went wrong</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              This section hit an unexpected error. You can retry, or head back
              to the dashboard.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={reset}>
              <RotateCcw /> Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Go to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
