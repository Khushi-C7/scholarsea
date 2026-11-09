import Link from "next/link";
import { FlaskConical } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Clearly-labeled notice shown when analysis runs without an AI provider
 * configured. The output is heuristic, not model-generated.
 */
export function DemoBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm",
        "border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10",
        className
      )}
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-[color:var(--warning)]" />
      <p className="text-foreground/90">
        <span className="font-medium">Demo mode.</span> This analysis is
        simulated from the document text with simple heuristics — not an AI
        model. Add an API key in{" "}
        <Link href="/settings" className="font-medium underline">
          Settings
        </Link>{" "}
        for full multi-agent analysis.
      </p>
    </div>
  );
}
