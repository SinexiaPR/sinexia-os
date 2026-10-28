"use client";

import Link from "next/link";
import { Bell, Settings, User } from "lucide-react";
import { useEffect, useState } from "react";

import { SignOutControl } from "@/components/auth/sign-out-control";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";
import { InstallMenuItem } from "@/components/pwa/install-menu-item";
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
import { NavBadge, NotificationDot } from "@/components/ui/nav-badge";
import type { Profile } from "@/types";

type UserMenuProps = {
  profile: Profile;
  /** Segunda línea del encabezado del menú (rol o nombre de la empresa). */
  subtitle?: string | null;
  notificationUnreadCount: number;
  /** Solo admin: enlace a Configuración en el menú. */
  settingsHref?: string;
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

/** Menú del avatar: perfil, notificaciones, instalar app y cerrar sesión. */
export function UserMenu({
  profile,
  subtitle,
  notificationUnreadCount,
  settingsHref,
}: UserMenuProps) {
  const [unreadCount, setUnreadCount] = useState(notificationUnreadCount);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    setUnreadCount(notificationUnreadCount);
  }, [notificationUnreadCount]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative size-11 rounded-full p-0"
            aria-label={
              unreadCount > 0
                ? `Menú de usuario, ${unreadCount} notificaciones sin leer`
                : "Menú de usuario"
            }
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(profile)}
              </AvatarFallback>
            </Avatar>
            {unreadCount > 0 ? (
              <NotificationDot className="absolute top-1.5 right-1.5" />
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            <div className="space-y-0.5">
              <p className="truncate text-sm font-medium">
                {profile.full_name ?? profile.email}
              </p>
              {subtitle ? (
                <p className="text-muted-foreground truncate text-xs font-normal">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile">
              <User />
              Perfil
            </Link>
          </DropdownMenuItem>
          {settingsHref ? (
            <DropdownMenuItem asChild>
              <Link href={settingsHref}>
                <Settings />
                Configuración
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setPanelOpen(true)}>
            <Bell />
            Notificaciones
            <NavBadge count={unreadCount} />
          </DropdownMenuItem>
          <InstallMenuItem />
          <DropdownMenuSeparator />
          <SignOutControl />
        </DropdownMenuContent>
      </DropdownMenu>

      <NotificationsPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        unreadCount={unreadCount}
        onUnreadCountChange={setUnreadCount}
      />
    </>
  );
}
