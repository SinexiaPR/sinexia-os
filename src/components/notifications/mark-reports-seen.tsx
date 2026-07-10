"use client";

import { useEffect } from "react";

import { notifyReportsSeen } from "@/hooks/use-unread-reports";
import {
  resolveReportsSeenTimestamp,
  setReportsLastSeenAt,
} from "@/lib/notifications/viewed-reports";

type MarkReportsSeenProps = {
  profileId: string;
  reportCreatedAts: string[];
};

export function MarkReportsSeen({
  profileId,
  reportCreatedAts,
}: MarkReportsSeenProps) {
  const reportsKey = reportCreatedAts.join("|");

  useEffect(() => {
    const timestamp = resolveReportsSeenTimestamp(reportCreatedAts);
    setReportsLastSeenAt(profileId, timestamp);
    notifyReportsSeen();
  }, [profileId, reportsKey, reportCreatedAts]);

  return null;
}
