import { Brand } from "@/components/layout/brand";
import { SidebarNav } from "@/components/layout/sidebar-nav";

/**
 * Static desktop sidebar. Fixed width, full height, its own surface
 * color. On small screens it is hidden and replaced by the mobile
 * drawer (see MobileSidebar), which reuses SidebarNav.
 */
export function Sidebar() {
  return (
    <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center border-b border-sidebar-border px-5">
        <Brand />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
      <div className="border-t border-sidebar-border px-5 py-3">
        <p className="text-xs text-muted-foreground">
          ScholarSea{" "}
          <span className="font-mono text-[11px]">v0.1.0</span>
        </p>
      </div>
    </aside>
  );
}
