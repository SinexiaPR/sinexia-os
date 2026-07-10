"use client";

import { useEffect, useMemo, useState } from "react";

const LOCAL_VIEWED_PREFIX = "sinexia:report-viewed:";
const VIEWED_EVENT = "sinexia:report-viewed";

/** Stable empty snapshot for SSR and initial client render. */
const EMPTY_VIEWED: string[] = [];

function readLocalViewedIds(profileId: string): string[] {
  if (typeof window === "undefined") {
    return EMPTY_VIEWED;
  }

  const raw = window.sessionStorage.getItem(`${LOCAL_VIEWED_PREFIX}${profileId}`);
  if (!raw) {
    return EMPTY_VIEWED;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return EMPTY_VIEWED;
    }
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return EMPTY_VIEWED;
  }
}

function viewedIdsEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function useLocalViewedIds(profileId: string): string[] {
  const [localViewed, setLocalViewed] = useState(EMPTY_VIEWED);

  useEffect(() => {
    function syncFromStorage() {
      setLocalViewed((prev) => {
        const next = readLocalViewedIds(profileId);
        return viewedIdsEqual(prev, next) ? prev : next;
      });
    }

    syncFromStorage();

    window.addEventListener(VIEWED_EVENT, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener(VIEWED_EVENT, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [profileId]);

  return localViewed;
}

export function addLocalViewedReport(profileId: string, reportId: string) {
  if (typeof window === "undefined") return;

  const current = readLocalViewedIds(profileId);
  if (current.includes(reportId)) return;

  window.sessionStorage.setItem(
    `${LOCAL_VIEWED_PREFIX}${profileId}`,
    JSON.stringify([...current, reportId]),
  );
  window.dispatchEvent(new Event(VIEWED_EVENT));
}

export function useUnreadReportsCount(
  profileId: string,
  reportIds: string[],
  viewedReportIds: string[],
): number {
  const localViewed = useLocalViewedIds(profileId);

  const viewed = useMemo(() => {
    const merged = new Set(viewedReportIds);
    for (const id of localViewed) {
      merged.add(id);
    }
    return merged;
  }, [viewedReportIds, localViewed]);

  return useMemo(
    () => reportIds.filter((id) => !viewed.has(id)).length,
    [reportIds, viewed],
  );
}

export function useIsReportUnread(
  reportId: string,
  viewedReportIds: string[],
  profileId: string,
): boolean {
  const localViewed = useLocalViewedIds(profileId);

  const viewed = useMemo(() => {
    const merged = new Set(viewedReportIds);
    for (const id of localViewed) {
      merged.add(id);
    }
    return merged;
  }, [viewedReportIds, localViewed]);

  return !viewed.has(reportId);
}

/** @deprecated */
export function notifyReportsSeen() {
  window.dispatchEvent(new Event(VIEWED_EVENT));
}
