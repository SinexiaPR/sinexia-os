"use client";

import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavBadge } from "@/components/ui/nav-badge";
import {
  formatRelativeDateSpanish,
} from "@/lib/date/format-relative";
import { cn } from "@/lib/utils";
import type { PortalNotification } from "@/services/notifications";

type NotificationBellProps = {
  initialUnreadCount: number;
  className?: string;
};

export function NotificationBell({
  initialUnreadCount,
  className,
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchNotifications();
      setItems(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch {
      setError("No se pudieron cargar las notificaciones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  useEffect(() => {
    if (open) {
      void loadNotifications();
    }
  }, [open, loadNotifications]);

  function handleNotificationClick(notification: PortalNotification) {
    startTransition(async () => {
      if (!notification.read) {
        await markNotificationRead(notification.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setItems((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read: true } : n,
          ),
        );
      }
      setOpen(false);
      router.push(notification.href);
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.error) {
        setError(result.error);
        return;
      }
      setUnreadCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      router.refresh();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative size-10 shrink-0", className)}
          aria-label="Notificaciones"
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5">
              <NavBadge count={unreadCount} />
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="z-50 w-[min(calc(100vw-2rem),22rem)] p-0"
      >
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Notificaciones</p>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              Marcar todas
            </button>
          ) : null}
        </div>

        <div className="max-h-[min(60vh,20rem)] overflow-y-auto overscroll-contain">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          ) : error ? (
            <p className="px-4 py-8 text-center text-sm text-destructive">
              {error}
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No tienes notificaciones nuevas.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    disabled={isPending}
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-60",
                      !item.read && "bg-primary/[0.03]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          item.read
                            ? "font-medium text-foreground/80"
                            : "font-semibold text-foreground",
                        )}
                      >
                        {item.title}
                      </p>
                      {!item.read ? (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-red-500" />
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                    {item.companyName ? (
                      <p className="text-[11px] font-medium text-muted-foreground/90">
                        {item.companyName}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      {formatRelativeDateSpanish(item.createdAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
