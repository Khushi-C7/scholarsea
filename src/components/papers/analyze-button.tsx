"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AnalyzeButton({
  paperId,
  hasAnalysis,
}: {
  paperId: string;
  hasAnalysis: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/papers/${paperId}/analyze`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Analysis failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button onClick={run} disabled={loading} variant={hasAnalysis ? "outline" : "default"}>
        {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {loading
          ? "Analyzing…"
          : hasAnalysis
            ? "Re-run analysis"
            : "Run analysis"}
      </Button>
      {error ? (
        <p className="flex items-center gap-1 text-xs text-[color:var(--destructive)]">
          <TriangleAlert className="size-3" /> {error}
        </p>
      ) : null}
    </div>
  );
}
