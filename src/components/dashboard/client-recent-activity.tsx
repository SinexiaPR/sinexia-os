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
      <p className="text-muted-foreground mt-1 text-sm">
        Últimos movimientos en su cuenta.
      </p>

      {items.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
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
                  className="hover:bg-muted/40 flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
                >
                  <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-foreground truncate text-sm font-medium">
                        {item.title}
                      </p>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {formatRelativeDateSpanish(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate text-xs">
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
