"use client";

/**
 * Intentionally empty: reports are marked viewed only on open/download
 * via markReportViewed(). Kept for backward-compatible imports.
 */
export function MarkReportsSeen(_props: {
  profileId: string;
  reportCreatedAts: string[];
}) {
  return null;
}
