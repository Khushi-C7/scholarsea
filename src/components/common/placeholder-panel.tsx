import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Honest placeholder for routes whose feature has not been built yet.
 * Shows the section icon, what the page will do, and a "planned" badge
 * so the shell never pretends a feature exists before it does.
 */
export function PlaceholderPanel({
  icon: Icon,
  title,
  description,
  planned,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  planned: string[];
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-5 px-6 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
          <Icon className="size-6" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-base font-semibold">{title}</h2>
            <Badge variant="muted">Planned</Badge>
          </div>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {planned.length > 0 ? (
          <ul className="mx-auto grid max-w-md gap-1.5 text-left text-sm text-muted-foreground">
            {planned.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-[7px] size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
