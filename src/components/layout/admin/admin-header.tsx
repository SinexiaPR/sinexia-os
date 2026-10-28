"use client";

import { MenuIcon } from "lucide-react";
import { useState } from "react";

import { CommandPaletteTrigger } from "@/components/layout/command-palette";
import { AdminSidebar } from "@/components/layout/admin/admin-sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import type { NavBadgeCounts } from "@/types/notifications";
import type { Profile } from "@/types";

type AdminHeaderProps = {
  profile: Profile;
  badgeCounts: NavBadgeCounts;
  notificationUnreadCount: number;
  className?: string;
};

export function AdminHeader({
  profile,
  badgeCounts,
  notificationUnreadCount,
  className,
}: AdminHeaderProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header
      className={cn(
        "border-border/80 bg-background/90 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur-md sm:gap-3 sm:px-6",
        className,
      )}
    >
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-11 md:hidden"
            aria-label="Abrir menú de navegación"
          >
            <MenuIcon className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="bg-sidebar text-sidebar-foreground flex w-72 flex-col gap-0 p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navegación</SheetTitle>
            <SheetDescription>
              Secciones del panel de administración
            </SheetDescription>
          </SheetHeader>
          <AdminSidebar
            badgeCounts={badgeCounts}
            onNavigate={() => setMobileNavOpen(false)}
            className="flex-1"
          />
        </SheetContent>
      </Sheet>

      <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight md:hidden">
        {siteConfig.firmName}
      </p>
      <div className="hidden min-w-0 flex-1 md:block">
        <CommandPaletteTrigger />
      </div>
      <CommandPaletteTrigger className="size-11 px-0 md:hidden" />

      <UserMenu
        profile={profile}
        subtitle="Administrador"
        settingsHref="/dashboard/admin/settings"
        notificationUnreadCount={notificationUnreadCount}
      />
    </header>
  );
}
