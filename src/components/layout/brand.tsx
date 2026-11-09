import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * ScholarSea wordmark + mark. The mark is an inline SVG (a page over a
 * waterline) so there are no external image assets to load.
 */
export function Brand({
  className,
  href = "/",
  onClick,
}: {
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      aria-label="ScholarSea home"
    >
      <BrandMark className="size-7 shrink-0" />
      <span className="text-[15px] font-semibold tracking-tight">
        Scholar<span className="text-primary">Sea</span>
      </span>
    </Link>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      {/* page */}
      <path
        d="M10 8.5h8.5a2 2 0 0 1 2 2V20H12a2 2 0 0 1-2-2V8.5Z"
        fill="var(--primary-foreground)"
        opacity="0.92"
      />
      <path
        d="M12.5 12h5.5M12.5 14.5h5.5M12.5 17h3.5"
        stroke="var(--primary)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* waterline */}
      <path
        d="M7 22.5c1.8 0 1.8 1.6 3.6 1.6s1.8-1.6 3.6-1.6 1.8 1.6 3.6 1.6 1.8-1.6 3.6-1.6 1.8 1.6 3.6 1.6"
        stroke="var(--primary-foreground)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
