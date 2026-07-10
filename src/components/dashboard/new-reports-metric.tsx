"use client";

import { useSyncExternalStore } from "react";

import { SurfaceCard } from "@/components/ui/surface-card";
import {
  countUnviewedReports,
  getReportsLastSeenAt,
} from "@/lib/notifications/viewed-reports";

type NewReportsMetricProps = {
  profileId: string;
  reports: { id: string; created_at: string }[];
};

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("sinexia:reports-seen", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("sinexia:reports-seen", onStoreChange);
  };
}

export function NewReportsMetricCard({
  profileId,
  reports,
}: NewReportsMetricProps) {
  const count = useSyncExternalStore(
    subscribe,
    () =>
      countUnviewedReports(profileId, reports, getReportsLastSeenAt(profileId)),
    () => reports.length,
  );

  return (
    <SurfaceCard padding="md">
      <p className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
        Reportes nuevos
      </p>
      <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
        {count}
      </p>
    </SurfaceCard>
  );
}
