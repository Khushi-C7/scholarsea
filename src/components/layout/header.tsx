import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { GlobalSearch } from "@/components/layout/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  AccountMenu,
  type AccountUser,
} from "@/components/layout/account-menu";

/**
 * Top application bar: mobile menu trigger, breadcrumbs, global search,
 * theme control, and account menu. Sticks to the top of the content
 * column and shares the content background.
 */
export function Header({ user }: { user: AccountUser | null }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <div className="flex items-center gap-2">
        <MobileSidebar />
        <div className="hidden sm:block">
          <Breadcrumbs />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-2">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <AccountMenu user={user} />
      </div>
    </header>
  );
}
