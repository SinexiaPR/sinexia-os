const STORAGE_PREFIX = "sinexia:reports:lastSeenAt:";

export function getReportsLastSeenAt(profileId: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(`${STORAGE_PREFIX}${profileId}`);
}

export function setReportsLastSeenAt(
  profileId: string,
  timestamp: string,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(`${STORAGE_PREFIX}${profileId}`, timestamp);
}

export function countUnreadReports(
  reportCreatedAts: string[],
  lastSeenAt: string | null,
): number {
  if (reportCreatedAts.length === 0) {
    return 0;
  }

  if (!lastSeenAt) {
    return reportCreatedAts.length;
  }

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

  const latest = reportCreatedAts.reduce((max, createdAt) => {
    return new Date(createdAt).getTime() > new Date(max).getTime()
      ? createdAt
      : max;
  }, reportCreatedAts[0]);

  return latest;
}
