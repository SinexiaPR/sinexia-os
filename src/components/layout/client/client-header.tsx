"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { SignOutControl } from "@/components/auth/sign-out-control";
import { ClientNav } from "@/components/layout/client/client-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  clientNavItems,
  clientInvoicesNavItem,
  getPageTitle,
  tresbePayrollNavItem,
} from "@/config/navigation";
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

function getInitials(profile: Profile) {
  const source = profile.full_name ?? profile.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ClientHeader({
  profile,
  companyName,
  companySlug,
  notificationUnreadCount,
  reportNotifications,
  invoicesEnabled = false,
  className,
}: ClientHeaderProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const title = useMemo(
    () =>
      getPageTitle(pathname, [
        clientNavItems[0],
        ...(companySlug === "tresbe" ? [tresbePayrollNavItem] : []),
        ...(invoicesEnabled ? [clientInvoicesNavItem] : []),
        ...clientNavItems.slice(1),
      ]),
    [companySlug, invoicesEnabled, pathname],
  );

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
            <Button variant="ghost" size="icon" className="md:hidden">
              <MenuIcon className="size-4" />
              <span className="sr-only">Abrir navegación</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col p-6">
            <SheetHeader className="mb-6 px-0">
              <SheetTitle className="text-left text-base font-semibold">
                {siteConfig.name}
              </SheetTitle>
            </SheetHeader>
            <ClientNav
              companyName={companyName}
              companySlug={companySlug}
              reportNotifications={reportNotifications}
              invoicesEnabled={invoicesEnabled}
              onNavigate={() => setMobileNavOpen(false)}
              className="flex-1"
            />
            <SignOutControl variant="nav" />
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1 md:hidden">
          <p className="truncate text-sm font-semibold">{title}</p>
        </div>

        <div className="hidden min-w-0 flex-1 md:block">
          <p className="text-muted-foreground truncate text-sm font-medium">
            {companyName ?? siteConfig.name}
          </p>
        </div>

        <NotificationBell initialUnreadCount={notificationUnreadCount} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative size-10 rounded-full p-0"
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-muted text-foreground text-xs font-medium">
                  {getInitials(profile)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {profile.full_name ?? profile.email}
                </p>
                {companyName ? (
                  <p className="text-muted-foreground text-xs">{companyName}</p>
                ) : null}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">Perfil</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
