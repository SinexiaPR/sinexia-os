import Link from "next/link";
import { CheckCircle2, Circle, Clock } from "lucide-react";

import { ManualStatusControl } from "@/components/dashboard/manual-status-control";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";
import type {
  ClientDashboardCard,
  DashboardItem,
} from "@/types/admin-client-dashboard";

const semaphoreClass = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
};
const semaphoreTitle = {
  green: "Todo al día",
  amber: "Hay ítems pendientes o en proceso",
};
const stateIcon = {
  done: CheckCircle2,
  in_progress: Clock,
  pending: Circle,
};
const stateIconClass = {
  done: "text-emerald-600",
  in_progress: "text-amber-600",
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

function ChecklistRow({ item }: { item: DashboardItem }) {
  const Icon = stateIcon[item.state];
  const updated = dateLabel(item.lastUpdated);
  return (
    <div className="flex h-8 items-center gap-2">
      <Link
        href={item.href}
        className="group grid min-w-0 flex-1 grid-cols-[14px_minmax(0,1fr)_84px_52px] items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-muted/60"
      >
        <Icon className={cn("size-3.5 shrink-0", stateIconClass[item.state])} />
        <span className="group-hover:text-primary min-w-0 truncate text-xs font-medium">
          {item.label}
        </span>
        <span className="text-muted-foreground truncate text-[11px]">
          {item.stateLabel}
        </span>
        <span className="text-muted-foreground text-right text-[11px] tabular-nums">
          {updated ?? ""}
        </span>
      </Link>
      {item.manual ? <ManualStatusControl item={item} /> : null}
    </div>
  );
}

export function AdminClientCards({ cards }: { cards: ClientDashboardCard[] }) {
  if (!cards.length) {
    return (
      <SurfaceCard>
        <p className="text-muted-foreground text-sm">
          No hay clientes activos configurados todavía.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ company, semaphore, items }) => (
        <SurfaceCard
          key={company.id}
          className="relative rounded-[6px] border p-3 shadow-none transition hover:border-primary/40"
        >
          <Link
            href={`/dashboard/admin/companies/${company.id}`}
            aria-label={`Ver ${company.name}`}
            className="absolute inset-0 z-0 cursor-pointer rounded-[6px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <div className="relative z-10 flex items-center justify-between gap-3 border-b pb-2">
            <h3 className="truncate text-sm font-semibold tracking-tight">
              {company.name}
            </h3>
            <span
              className={cn("size-2 shrink-0 rounded-full", semaphoreClass[semaphore])}
              role="img"
              aria-label={semaphoreTitle[semaphore]}
              title={semaphoreTitle[semaphore]}
            />
          </div>
          <div className="relative z-10 mt-1 divide-y divide-border/60">
            {items.length ? (
              items.map((item) => <ChecklistRow key={item.id} item={item} />)
            ) : (
              <p className="text-muted-foreground py-2 text-xs">
                Sin acciones configuradas.
              </p>
            )}
          </div>
        </SurfaceCard>
      ))}
    </div>
  );
}
