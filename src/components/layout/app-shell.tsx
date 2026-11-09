import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import type { AccountUser } from "@/components/layout/account-menu";

/**
 * The persistent workspace frame: fixed sidebar + header, with a single
 * independently scrolling content region. Used by the (app) route group
 * layout so every page shares the same chrome.
 */
export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: AccountUser | null;
}) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header user={user} />
        <main id="main-content" className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
