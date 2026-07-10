"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AdminSidebar } from "@/components/layout/admin/admin-sidebar";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
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
import { adminNavItems, getPageTitle } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { NavBadgeCounts } from "@/types/notifications";
import type { AppNotification, Profile } from "@/types";

type AdminHeaderProps = {
  profile: Profile;
  badgeCounts: NavBadgeCounts;
  notifications: AppNotification[];
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

export function AdminHeader({
  profile,
  badgeCounts,
  notifications,
  className,
}: AdminHeaderProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const title = useMemo(
    () => getPageTitle(pathname, adminNavItems),
    [pathname],
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/80 bg-card/95 px-4 backdrop-blur-md sm:h-16 sm:px-6",
        className,
      )}
    >
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-11 md:hidden"
            aria-label="Abrir menú"
          >
            <MenuIcon className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[min(100%,20rem)] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navegación</SheetTitle>
          </SheetHeader>
          <AdminSidebar
            badgeCounts={badgeCounts}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold tracking-tight">
          {title}
        </h1>
        <p className="hidden text-xs text-muted-foreground sm:block md:hidden">
          Administración
        </p>
      </div>

      <div className="hidden sm:block md:hidden">
        <BrandLogo href="/dashboard" markOnly size="sm" />
      </div>

      <NotificationsBell
        notifications={notifications}
        unreadCount={badgeCounts.notifications}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative size-11 rounded-full p-0"
            aria-label="Menú de cuenta"
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary text-xs text-primary-foreground">
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
              <p className="text-xs text-muted-foreground">Administrador</p>
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
    </header>
  );
}
