"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Bell } from "lucide-react";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavBadge } from "@/components/ui/nav-badge";
import { formatDateTimeEs } from "@/lib/portal/format";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";

type NotificationsBellProps = {
  notifications: AppNotification[];
  unreadCount: number;
  className?: string;
};

export function NotificationsBell({
  notifications,
  unreadCount,
  className,
}: NotificationsBellProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative size-11 rounded-full", className)}
          aria-label={
            unreadCount > 0
              ? `Notificaciones, ${unreadCount} sin leer`
              : "Notificaciones"
          }
        >
          <Bell className="size-5" />
          {unreadCount > 0 ? (
            <span className="absolute top-1.5 right-1.5">
              <NavBadge count={unreadCount} className="ml-0" />
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,22rem)] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <DropdownMenuLabel className="p-0">Notificaciones</DropdownMenuLabel>
          {unreadCount > 0 ? (
            <button
              type="button"
              disabled={isPending}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
              onClick={() => {
                startTransition(async () => {
                  await markAllNotificationsRead();
                });
              }}
            >
              Marcar todas
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="my-0" />

        {notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay notificaciones.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {notifications.map((notification) => {
              const unread = !notification.read_at;
              const content = (
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {notification.title}
                    </p>
                    {unread ? (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-500" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {notification.body}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDateTimeEs(notification.created_at)}
                  </p>
                </div>
              );

              return (
                <li key={notification.id}>
                  {notification.href ? (
                    <Link
                      href={notification.href}
                      className={cn(
                        "flex gap-3 px-3 py-3 transition-colors hover:bg-muted/60",
                        unread && "bg-navy-soft/40",
                      )}
                      onClick={() => {
                        if (unread) {
                          startTransition(async () => {
                            await markNotificationRead(notification.id);
                          });
                        }
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={cn(
                        "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60",
                        unread && "bg-navy-soft/40",
                      )}
                      onClick={() => {
                        if (unread) {
                          startTransition(async () => {
                            await markNotificationRead(notification.id);
                          });
                        }
                      }}
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
