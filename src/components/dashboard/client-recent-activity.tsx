"use client";

import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  FileText,
  Sparkles,
  Upload,
} from "lucide-react";

import { formatRelativeDateSpanish } from "@/lib/date/format-relative";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { ClientActivityItem } from "@/services/client-dashboard";

const activityIcons = {
  document_received: Upload,
  document_reviewing: FileText,
  document_processed: CheckCircle2,
  report_published: BarChart3,
  document_analyzed: Sparkles,
} as const;

type ClientRecentActivityProps = {
  items: ClientActivityItem[];
};

export function ClientRecentActivity({ items }: ClientRecentActivityProps) {
  return (
    <SurfaceCard padding="md">
      <h2 className="text-base font-semibold tracking-tight">
        Actividad reciente
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Últimos movimientos en su cuenta.
      </p>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Sin actividad reciente todavía.
        </p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {items.map((item) => {
            const Icon = activityIcons[item.kind];

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeDateSpanish(item.timestamp)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SurfaceCard>
  );
}
