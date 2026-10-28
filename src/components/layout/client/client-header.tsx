"use client";

import Link from "next/link";
import { MenuIcon, Sparkles } from "lucide-react";
import { useState } from "react";

import { ClientNav } from "@/components/layout/client/client-nav";
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
import type { ClientReportNotifications } from "@/types/notifications";
import type { Profile } from "@/types";

type ClientHeaderProps = {
  profile: Profile;
  companyName?: string | null;
  companySlug?: string | null;
  notificationUnreadCount: number;
  reportNotifications: ClientReportNotifications;
  invoicesEnabled?: boolean;
  className?: string;
};

export function ClientHeader({
  profile,
  companyName,
  companySlug,
  notificationUnreadCount,
  reportNotifications,
  invoicesEnabled = false,
  className,
}: ClientHeaderProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header
      className={cn(
        "border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:hidden"
              aria-label="Abrir menú de navegación"
            >
              <MenuIcon className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col p-6">
            <SheetHeader className="mb-6 px-0">
              <SheetTitle className="text-left text-base font-semibold">
                {siteConfig.name}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Secciones de tu portal
              </SheetDescription>
            </SheetHeader>
            <ClientNav
              companyName={companyName}
              companySlug={companySlug}
              reportNotifications={reportNotifications}
              invoicesEnabled={invoicesEnabled}
              onNavigate={() => setMobileNavOpen(false)}
              className="flex-1"
            />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1 md:hidden">
          <p className="truncate text-sm font-semibold">{siteConfig.name}</p>
        </div>

        <div className="hidden min-w-0 flex-1 md:block">
          <p className="text-muted-foreground truncate text-sm font-medium">
            {companyName ?? siteConfig.name}
          </p>
        </div>

        <Button asChild variant="outline" className="h-10 gap-2">
          <Link href="/dashboard/sia">
            <Sparkles className="size-4" />
            <span className="hidden sm:inline">Preguntar a SinexIA</span>
            <span className="sr-only sm:hidden">SinexIA</span>
          </Link>
        </Button>

        <UserMenu
          profile={profile}
          subtitle={companyName}
          notificationUnreadCount={notificationUnreadCount}
        />
      </div>
    </header>
  );
}
