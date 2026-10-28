import Link from "next/link";
import { BarChart3, CheckCircle2, FileText } from "lucide-react";

import { SurfaceCard } from "@/components/ui/surface-card";
import type { AdminActivityItem } from "@/services/activity";
import { cn } from "@/lib/utils";

type RecentActivityFeedProps = {
  items: AdminActivityItem[];
  className?: string;
  /** Solo la lista, sin tarjeta ni encabezado (para usar dentro de un acordeón). */
  bare?: boolean;
};

const activityIcons = {
  document_received: FileText,
  document_processed: CheckCircle2,
  report_published: BarChart3,
} as const;

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("es", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function ActivityList({ items }: { items: AdminActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Todavía no hay actividad reciente.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const Icon = activityIcons[item.kind];
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              className="border-border/70 hover:bg-muted/40 focus-visible:ring-ring flex min-h-11 items-start gap-3 rounded-md border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span
                aria-hidden
                className="bg-info-soft text-info mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-3">
                  <span className="text-foreground text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatTimestamp(item.timestamp)}
                  </span>
                </span>
                <span className="text-muted-foreground mt-1 block text-sm">
                  {item.description}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function RecentActivityFeed({
  items,
  className,
  bare = false,
}: RecentActivityFeedProps) {
  if (bare) return <ActivityList items={items} />;
  return (
    <SurfaceCard className={className} padding="md">
      <h2 className="text-base font-semibold tracking-tight">
        Actividad reciente
      </h2>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">
        Últimos documentos y reportes publicados de todas las empresas.
      </p>
      <ActivityList items={items} />
    </SurfaceCard>
  );
}

type PendingMetricCardProps = {
  label: string;
  value: number;
  hint?: string;
  href?: string;
  className?: string;
};

export function PendingMetricCard({
  label,
  value,
  hint,
  href = "/dashboard/inbox",
  className,
}: PendingMetricCardProps) {
  const content = (
    <SurfaceCard
      className={cn("relative flex flex-col justify-between", className)}
      padding="lg"
    >
      {value > 0 ? (
        <span className="absolute top-6 right-6">
          <span className="flex size-5 items-center justify-center rounded-full bg-red-500/90 text-[11px] font-semibold text-white">
            {value > 9 ? "9+" : value}
          </span>
        </span>
      ) : null}
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="mt-6">
        <p className="text-foreground text-4xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {hint ? (
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {hint}
          </p>
        ) : null}
      </div>
    </SurfaceCard>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-95">
        {content}
      </Link>
    );
  }

  return content;
}
