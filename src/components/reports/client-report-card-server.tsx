import { ClientReportCardView } from "@/components/reports/client-report-card";
import { getSignedReportFileUrl } from "@/services/reports";
import type { ReportWithCompany } from "@/types";

type ClientReportCardProps = {
  report: ReportWithCompany;
  profileId: string;
};

export async function ClientReportCard({
  report,
  profileId,
}: ClientReportCardProps) {
  const signedUrl = await getSignedReportFileUrl(report.file_url);

  return (
    <ClientReportCardView
      report={report}
      profileId={profileId}
      signedUrl={signedUrl}
    />
  );
}
