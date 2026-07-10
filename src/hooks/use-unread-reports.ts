"use client";

import { useSyncExternalStore } from "react";

const LOCAL_VIEWED_PREFIX = "sinexia:report-viewed:";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("sinexia:report-viewed", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("sinexia:report-viewed", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getLocalViewedIds(profileId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  const raw = window.sessionStorage.getItem(`${LOCAL_VIEWED_PREFIX}${profileId}`);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function addLocalViewedReport(profileId: string, reportId: string) {
  if (typeof window === "undefined") return;
  const current = getLocalViewedIds(profileId);
  current.add(reportId);
  window.sessionStorage.setItem(
    `${LOCAL_VIEWED_PREFIX}${profileId}`,
    JSON.stringify([...current]),
  );
  window.dispatchEvent(new Event("sinexia:report-viewed"));
}

export function useUnreadReportsCount(
  profileId: string,
  reportIds: string[],
  viewedReportIds: string[],
): number {
  const localViewed = useSyncExternalStore(
    subscribe,
    () => getLocalViewedIds(profileId),
    () => new Set<string>(),
  );

  const viewed = new Set([...viewedReportIds, ...localViewed]);
  return reportIds.filter((id) => !viewed.has(id)).length;
}

export function useIsReportUnread(
  reportId: string,
  viewedReportIds: string[],
  profileId: string,
): boolean {
  const localViewed = useSyncExternalStore(
    subscribe,
    () => getLocalViewedIds(profileId),
    () => new Set<string>(),
  );

  const viewed = new Set([...viewedReportIds, ...localViewed]);
  return !viewed.has(reportId);
}

/** @deprecated */
export function notifyReportsSeen() {
  window.dispatchEvent(new Event("sinexia:report-viewed"));
}
