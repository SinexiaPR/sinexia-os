"use client";

/**
 * Per-report viewed tracking (client-side).
 * Complements the existing lastSeenAt bulk marker used for nav badges.
 */

const VIEWED_PREFIX = "sinexia:reports:viewed:";
const LAST_SEEN_PREFIX = "sinexia:reports:lastSeenAt:";

function viewedKey(profileId: string) {
  return `${VIEWED_PREFIX}${profileId}`;
}

export function getViewedReportIds(profileId: string): Set<string> {
  if (typeof window === "undefined" || !profileId) {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(viewedKey(profileId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function markReportViewed(profileId: string, reportId: string): void {
  if (typeof window === "undefined" || !profileId || !reportId) return;

  const viewed = getViewedReportIds(profileId);
  viewed.add(reportId);
  window.localStorage.setItem(
    viewedKey(profileId),
    JSON.stringify([...viewed]),
  );
  window.dispatchEvent(new Event("sinexia:reports-seen"));
}

export function markReportsViewed(
  profileId: string,
  reportIds: string[],
): void {
  if (typeof window === "undefined" || !profileId) return;

  const viewed = getViewedReportIds(profileId);
  for (const id of reportIds) {
    viewed.add(id);
  }
  window.localStorage.setItem(
    viewedKey(profileId),
    JSON.stringify([...viewed]),
  );
  window.dispatchEvent(new Event("sinexia:reports-seen"));
}

export function isReportViewed(profileId: string, reportId: string): boolean {
  return getViewedReportIds(profileId).has(reportId);
}

export function countUnviewedReports(
  profileId: string,
  reports: { id: string; created_at: string }[],
  lastSeenAt: string | null,
): number {
  if (reports.length === 0) return 0;

  const viewed = getViewedReportIds(profileId);
  const seenTime = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;

  return reports.filter((report) => {
    if (viewed.has(report.id)) return false;
    // Also treat as read if bulk lastSeen covers it (legacy behavior)
    if (lastSeenAt && new Date(report.created_at).getTime() <= seenTime) {
      return false;
    }
    return true;
  }).length;
}

export function getReportsLastSeenAt(profileId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${LAST_SEEN_PREFIX}${profileId}`);
}

export function setReportsLastSeenAt(
  profileId: string,
  timestamp: string,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${LAST_SEEN_PREFIX}${profileId}`, timestamp);
}

export function countUnreadReports(
  reportCreatedAts: string[],
  lastSeenAt: string | null,
): number {
  if (reportCreatedAts.length === 0) return 0;
  if (!lastSeenAt) return reportCreatedAts.length;

  const seenTime = new Date(lastSeenAt).getTime();
  return reportCreatedAts.filter(
    (createdAt) => new Date(createdAt).getTime() > seenTime,
  ).length;
}

export function resolveReportsSeenTimestamp(
  reportCreatedAts: string[],
): string {
  if (reportCreatedAts.length === 0) {
    return new Date().toISOString();
  }

  return reportCreatedAts.reduce((max, createdAt) => {
    return new Date(createdAt).getTime() > new Date(max).getTime()
      ? createdAt
      : max;
  }, reportCreatedAts[0]);
}
