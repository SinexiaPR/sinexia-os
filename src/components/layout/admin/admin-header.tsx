"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { SignOutControl } from "@/components/auth/sign-out-control";
import { AdminSidebar } from "@/components/layout/admin/admin-sidebar";
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
import { adminNavItems, getPageTitle } from "@/config/navigation";
import { cn } from "@/lib/utils";
import type { NavBadgeCounts } from "@/types/notifications";
import type { Profile } from "@/types";

type AdminHeaderProps = {
  profile: Profile;
  badgeCounts: NavBadgeCounts;
  notificationUnreadCount: number;
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
  notificationUnreadCount,
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
        "sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/80 bg-background/90 px-4 backdrop-blur-md sm:gap-3 sm:px-6",
        className,
      )}
    >
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden">
            <MenuIcon className="size-4" />
            <span className="sr-only">Abrir navegación</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navegación</SheetTitle>
          </SheetHeader>
          <AdminSidebar
            badgeCounts={badgeCounts}
            onNavigate={() => setMobileNavOpen(false)}
            className="flex-1"
          />
          <div className="border-t border-sidebar-border p-3">
            <SignOutControl variant="nav" />
          </div>
        </SheetContent>
      </Sheet>

      <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight">
        {title}
      </h1>

      <NotificationBell initialUnreadCount={notificationUnreadCount} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative size-10 rounded-full p-0">
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
            <Link href="/dashboard/profile">Perfil</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
