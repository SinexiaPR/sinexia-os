import { cn } from "@/lib/utils";

type NavBadgeProps = {
  count?: number;
  className?: string;
};

export function NavBadge({ count, className }: NavBadgeProps) {
  if (!count || count <= 0) {
    return null;
  }

  return (
    <span
      className={cn(
        "ml-auto flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500/90 px-1.5 text-[10px] font-semibold text-white tabular-nums shadow-sm",
        className,
      )}
      aria-label={`${count} ${count === 1 ? "pendiente" : "pendientes"}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

type NotificationDotProps = {
  className?: string;
};

export function NotificationDot({ className }: NotificationDotProps) {
  return (
    <span
      className={cn(
        "ring-background size-2 shrink-0 rounded-full bg-red-500/90 ring-2",
        className,
      )}
      aria-hidden
    />
  );
}
