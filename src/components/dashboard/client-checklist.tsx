import Link from "next/link";
import { CheckCircle2, Circle, Clock } from "lucide-react";

import { ManualStatusControl } from "@/components/dashboard/manual-status-control";
import { cn } from "@/lib/utils";
import type { DashboardItem } from "@/types/admin-client-dashboard";

const stateIcon = {
  done: CheckCircle2,
  in_progress: Clock,
  pending: Circle,
};
const stateIconClass = {
  done: "text-success",
  in_progress: "text-warning",
  pending: "text-muted-foreground",
};

function dateLabel(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(value));
}

/** Fila de una tarea de cliente: enlace al módulo + control manual si aplica. */
export function ChecklistRow({ item }: { item: DashboardItem }) {
  const Icon = stateIcon[item.state];
  const updated = dateLabel(item.lastUpdated);
  return (
    <div className="flex min-h-11 items-center gap-2">
      <Link
        href={item.href}
        className="group hover:bg-muted/60 focus-visible:ring-ring grid min-w-0 flex-1 grid-cols-[16px_minmax(0,1fr)] items-center gap-x-3 rounded-md px-2 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:grid-cols-[16px_minmax(0,1fr)_minmax(0,1.4fr)_48px]"
      >
        <Icon
          aria-hidden
          className={cn("size-4 shrink-0", stateIconClass[item.state])}
        />
        <span className="group-hover:text-primary min-w-0 truncate text-sm font-medium">
          {item.label}
        </span>
        <span className="text-muted-foreground col-start-2 min-w-0 truncate text-xs sm:col-start-auto">
          {item.stateLabel}
        </span>
        <span className="text-muted-foreground hidden text-right text-xs tabular-nums sm:block">
          {updated ?? ""}
        </span>
      </Link>
      {item.manual ? <ManualStatusControl item={item} /> : null}
    </div>
  );
}
