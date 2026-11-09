"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Brand } from "@/components/layout/brand";
import { SidebarNav } from "@/components/layout/sidebar-nav";

/**
 * Drawer version of the sidebar for tablet/phone. Opens from the left
 * and closes automatically when the route changes or a link is tapped.
 */
export function MobileSidebar() {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <div className="flex h-14 items-center border-b border-sidebar-border px-5">
          <SheetTitle asChild>
            <Brand onClick={close} />
          </SheetTitle>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav onNavigate={close} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
