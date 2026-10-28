"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  fetchNotifications,
  markAllNotificationsRead,
  openNotification,
} from "@/actions/notifications";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatRelativeDateSpanish } from "@/lib/date/format-relative";
import { cn } from "@/lib/utils";
import type { PortalNotification } from "@/services/notifications";

type NotificationsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
};

export function NotificationsPanel({
  open,
  onOpenChange,
  unreadCount,
  onUnreadCountChange,
}: NotificationsPanelProps) {
  const router = useRouter();
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
      onUnreadCountChange(result.unreadCount);
    } catch {
      setError("No se pudieron cargar las notificaciones.");
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    if (open) {
      void loadNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open]);

  function handleNotificationClick(notification: PortalNotification) {
    const previousUnread = unreadCount;
    const previousItems = items;

    startTransition(async () => {
      if (!notification.read) {
        onUnreadCountChange(Math.max(0, unreadCount - 1));
        setItems((prev) =>
          prev.map((item) =>
            item.id === notification.id ? { ...item, read: true } : item,
          ),
        );
      }

      const result = await openNotification({
        notificationId: notification.id,
        reportId: notification.reportId,
        documentId: notification.documentId,
      });

      if (result.error) {
        onUnreadCountChange(previousUnread);
        setItems(previousItems);
        setError(result.error);
        return;
      }

      onOpenChange(false);
      router.refresh();
      router.push(notification.href);
    });
  }

  function handleMarkAllRead() {
    const previousUnread = unreadCount;
    const previousItems = items;

    startTransition(async () => {
      onUnreadCountChange(0);
      setItems((prev) => prev.map((item) => ({ ...item, read: true })));

      const result = await markAllNotificationsRead();
      if (result.error) {
        onUnreadCountChange(previousUnread);
        setItems(previousItems);
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-sm"
      >
        <SheetHeader className="border-border/70 flex-row items-center justify-between space-y-0 border-b px-4 py-3 pr-12">
          <div>
            <SheetTitle className="text-sm font-semibold">
              Notificaciones
            </SheetTitle>
            <SheetDescription className="sr-only">
              Actividad reciente de tu cuenta
            </SheetDescription>
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="text-primary text-xs font-medium hover:underline disabled:opacity-50"
            >
              Marcar todas como leídas
            </button>
          ) : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              Cargando…
            </p>
          ) : error ? (
            <p className="text-destructive px-4 py-8 text-center text-sm">
              {error}
            </p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              No tienes notificaciones nuevas.
            </p>
          ) : (
            <ul className="divide-border/60 divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    disabled={isPending}
                    className={cn(
                      "hover:bg-muted/40 flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors disabled:opacity-60",
                      !item.read && "bg-primary/[0.03]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          item.read
                            ? "text-foreground/80 font-medium"
                            : "text-foreground font-semibold",
                        )}
                      >
                        {item.title}
                      </p>
                      {!item.read ? (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-red-500" />
                      ) : null}
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                      {item.description}
                    </p>
                    {item.companyName ? (
                      <p className="text-muted-foreground/90 text-[11px] font-medium">
                        {item.companyName}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground text-[11px]">
                      {formatRelativeDateSpanish(item.createdAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
