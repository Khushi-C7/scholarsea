"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { matchNavItem } from "@/lib/navigation";

/**
 * Lightweight breadcrumbs derived from the current route. For the flat
 * top-level pages in the shell this is "Home / <Section>"; nested
 * routes added later can extend this.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const current = matchNavItem(pathname);

  // On the dashboard root, show a single label rather than a trail.
  if (pathname === "/") {
    return (
      <span className="text-sm font-medium text-foreground">Dashboard</span>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link
        href="/"
        className="text-muted-foreground transition-colors hover:text-foreground"
      >
        Home
      </Link>
      {current ? (
        <>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <span className="font-medium text-foreground">{current.label}</span>
        </>
      ) : null}
    </nav>
  );
}
