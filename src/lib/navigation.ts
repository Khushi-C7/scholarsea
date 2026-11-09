import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderKanban,
  Library,
  FilePlus2,
  Telescope,
  GitCompareArrows,
  MessagesSquare,
  Share2,
  Bot,
  History,
  Settings,
} from "lucide-react";

export interface NavItem {
  /** Display label in the sidebar. */
  label: string;
  /** Route the item links to. */
  href: string;
  /** Lucide icon component. */
  icon: LucideIcon;
  /** One-line description used for tooltips / page intros. */
  description: string;
}

/**
 * Primary navigation. The order here is the order shown in the sidebar.
 * Mirrors the application shell defined in the product spec (section 4).
 */
export const PRIMARY_NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    description: "Overview of your research activity.",
  },
  {
    label: "Research Projects",
    href: "/projects",
    icon: FolderKanban,
    description: "Organize papers, notes, and reports into projects.",
  },
  {
    label: "Paper Library",
    href: "/library",
    icon: Library,
    description: "Every paper you have ingested or imported.",
  },
  {
    label: "New Research",
    href: "/new",
    icon: FilePlus2,
    description: "Ingest a paper by text, PDF, URL, or academic search.",
  },
  {
    label: "Research Gap Explorer",
    href: "/gaps",
    icon: Telescope,
    description: "Find evidence-linked gaps across a set of papers.",
  },
  {
    label: "Paper Comparison",
    href: "/compare",
    icon: GitCompareArrows,
    description: "Compare papers across consistent dimensions.",
  },
  {
    label: "Research Chat",
    href: "/chat",
    icon: MessagesSquare,
    description: "Ask questions grounded in one paper or a collection.",
  },
  {
    label: "Knowledge Graph",
    href: "/graph",
    icon: Share2,
    description: "Explore relationships between papers and concepts.",
  },
  {
    label: "Autonomous Research Agent",
    href: "/agent",
    icon: Bot,
    description: "Give a goal; watch a bounded research run execute.",
  },
  {
    label: "Research History",
    href: "/history",
    icon: History,
    description: "Past analyses, gap runs, and agent sessions.",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Providers, keys, preferences, and data management.",
  },
];

/** Look up the nav item whose route best matches a pathname. */
export function matchNavItem(pathname: string): NavItem | undefined {
  // Exact match first (handles "/").
  const exact = PRIMARY_NAV.find((item) => item.href === pathname);
  if (exact) return exact;
  // Otherwise the longest non-root prefix that the pathname starts under.
  return PRIMARY_NAV.filter((item) => item.href !== "/")
    .filter((item) => pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** True when `item` should render as the active route for `pathname`. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
