"use client";

import { useSyncExternalStore } from "react";

import {
  countUnviewedReports,
  getReportsLastSeenAt,
  getViewedReportIds,
} from "@/lib/notifications/viewed-reports";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("sinexia:reports-seen", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("sinexia:reports-seen", onStoreChange);
  };
}

export function notifyReportsSeen() {
  window.dispatchEvent(new Event("sinexia:reports-seen"));
}

/** Legacy lastSeen-based count (kept for compatibility). */
export function useUnreadReportsCount(
  profileId: string,
  reportCreatedAts: string[],
): number {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!profileId || reportCreatedAts.length === 0) return 0;
      const lastSeenAt = getReportsLastSeenAt(profileId);
      if (!lastSeenAt) return reportCreatedAts.length;
      const seenTime = new Date(lastSeenAt).getTime();
      return reportCreatedAts.filter(
        (createdAt) => new Date(createdAt).getTime() > seenTime,
      ).length;
    },
    () => reportCreatedAts.length,
  );
}

export function useUnviewedReportsCount(
  profileId: string,
  reports: { id: string; created_at: string }[],
): number {
  return useSyncExternalStore(
    subscribe,
    () =>
      countUnviewedReports(
        profileId,
        reports,
        getReportsLastSeenAt(profileId),
      ),
    () => reports.length,
  );
}

export function useIsReportViewed(
  profileId: string,
  reportId: string,
  createdAt: string,
): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (getViewedReportIds(profileId).has(reportId)) return true;
      const lastSeen = getReportsLastSeenAt(profileId);
      if (!lastSeen) return false;
      return new Date(createdAt).getTime() <= new Date(lastSeen).getTime();
    },
    () => false,
  );
}
