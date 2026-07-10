"use client";

import { useSyncExternalStore } from "react";

import {
  countUnreadReports,
  getReportsLastSeenAt,
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

export function useUnreadReportsCount(
  profileId: string,
  reportCreatedAts: string[],
): number {
  const lastSeenAt = useSyncExternalStore(
    subscribe,
    () => getReportsLastSeenAt(profileId),
    () => null,
  );

  return countUnreadReports(reportCreatedAts, lastSeenAt);
}
