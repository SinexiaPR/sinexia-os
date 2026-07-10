import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  FileText,
} from "lucide-react";

import { SurfaceCard } from "@/components/ui/surface-card";
import type { AdminActivityItem } from "@/services/activity";
import { cn } from "@/lib/utils";

type RecentActivityFeedProps = {
  items: AdminActivityItem[];
  className?: string;
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

export function RecentActivityFeed({
  items,
  className,
}: RecentActivityFeedProps) {
  return (
    <SurfaceCard className={className} padding="md">
      <h2 className="text-base font-semibold tracking-tight">
        Actividad reciente
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Últimos documentos y reportes publicados en todas las empresas.
      </p>

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Aún no hay actividad reciente.
        </p>
      ) : (
        <div className="mt-5 space-y-2">
          {items.map((item) => {
            const Icon = activityIcons[item.kind];
            const isPending =
              item.kind === "document_received";

            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-start gap-3 rounded-xl border border-border/70 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    isPending
                      ? "bg-red-500/10 text-red-600"
                      : "bg-navy-soft text-primary",
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
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
          <span className="flex size-5 items-center justify-center rounded-full bg-red-500/90 text-[10px] font-semibold text-white">
            {value > 9 ? "9+" : value}
          </span>
        </span>
      ) : null}
      <p className="text-[13px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-6">
        <p className="text-4xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        {hint ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
