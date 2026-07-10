"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ClientNav } from "@/components/layout/client/client-nav";
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
import { clientNavItems, getPageTitle } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { ClientReportNotifications } from "@/types/notifications";
import type { Profile } from "@/types";

type ClientHeaderProps = {
  profile: Profile;
  companyName?: string | null;
  inboxCount: number;
  reportNotifications: ClientReportNotifications;
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
  inboxCount,
  reportNotifications,
  className,
}: ClientHeaderProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const title = useMemo(
    () => getPageTitle(pathname, clientNavItems),
    [pathname],
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border/70 bg-card/90 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:h-16 sm:px-6">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 md:hidden"
              aria-label="Abrir menú"
            >
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[min(100%,20rem)] p-6">
            <SheetHeader className="mb-6 px-0 text-left">
              <SheetTitle className="sr-only">Menú</SheetTitle>
              <div className="text-left">
                <p className="font-display text-base font-semibold tracking-[0.14em] text-primary uppercase">
                  SINEXIA
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Portal de Clientes
                </p>
              </div>
            </SheetHeader>
            <ClientNav
              companyName={companyName}
              inboxCount={inboxCount}
              reportNotifications={reportNotifications}
              onNavigate={() => setMobileNavOpen(false)}
            />
            <div className="mt-8 border-t border-border/70 pt-4">
              <SignOutButton variant="button" />
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1 md:hidden">
          <p className="truncate text-sm font-semibold text-foreground">
            {title}
          </p>
          {companyName ? (
            <p className="truncate text-xs text-muted-foreground">
              {companyName}
            </p>
          ) : null}
        </div>

        <div className="hidden min-w-0 flex-1 md:block">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {companyName ?? "Portal de Clientes"}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative size-11 rounded-full p-0"
              aria-label="Menú de cuenta"
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
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
                  <p className="text-xs text-muted-foreground">{companyName}</p>
                ) : null}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">Mi cuenta</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <SignOutButton />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
