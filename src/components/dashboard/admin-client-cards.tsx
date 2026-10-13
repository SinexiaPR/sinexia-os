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
  red: "bg-red-500",
};
const semaphoreLabel = {
  green: "Al día",
  amber: "Pendiente",
  red: "Vencido",
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
    <div className="flex items-start gap-3">
      <Link
        href={item.href}
        className="hover:border-primary/40 group flex min-w-0 flex-1 items-start gap-3 rounded-lg border border-transparent px-2 py-1.5 transition hover:border"
      >
        <Icon className={cn("mt-0.5 size-4 shrink-0", stateIconClass[item.state])} />
        <span className="min-w-0 flex-1">
          <span className="group-hover:text-primary block truncate text-sm font-medium">
            {item.label}
          </span>
          <span className="text-muted-foreground block text-xs">
            {item.stateLabel}
            {updated ? ` · ${updated}` : ""}
          </span>
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
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ company, semaphore, items }) => (
        <SurfaceCard key={company.id} padding="md">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold tracking-tight">
              {company.name}
            </h3>
            <span className="flex items-center gap-1.5">
              <span
                className={cn("size-2.5 rounded-full", semaphoreClass[semaphore])}
                aria-hidden
              />
              <span className="text-muted-foreground text-xs font-medium">
                {semaphoreLabel[semaphore]}
              </span>
            </span>
          </div>
          <div className="mt-4 space-y-1">
            {items.length ? (
              items.map((item) => <ChecklistRow key={item.id} item={item} />)
            ) : (
              <p className="text-muted-foreground text-sm">
                Sin acciones configuradas.
              </p>
            )}
          </div>
        </SurfaceCard>
      ))}
    </div>
  );
}
