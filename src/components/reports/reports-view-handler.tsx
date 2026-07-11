"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { markReportViewed } from "@/actions/notifications";
import { addLocalViewedReport } from "@/hooks/use-unread-reports";

type ReportsViewHandlerProps = {
  profileId: string;
};

export function ReportsViewHandler({ profileId }: ReportsViewHandlerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handledRef = useRef<string | null>(null);

  const viewReportId = searchParams.get("view");

  useEffect(() => {
    if (!viewReportId || handledRef.current === viewReportId) {
      return;
    }

    handledRef.current = viewReportId;

    const anchor = document.getElementById(`report-${viewReportId}`);
    if (anchor) {
      anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    void (async () => {
      const result = await markReportViewed(viewReportId);
      if (result.error) {
        handledRef.current = null;
        return;
      }

      addLocalViewedReport(profileId, viewReportId);
      window.dispatchEvent(new Event("sinexia:report-viewed"));
      router.refresh();
    })();
  }, [viewReportId, profileId, router]);

  return null;
}
