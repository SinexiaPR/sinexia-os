import { PackageWorkspace } from "@/components/cutmeat-reports/package-workspace";
import { suggestReportDate } from "@/services/cutmeat-daily";
import {
  checkPackageEligibility,
  getPackageVersions,
  requirePackageAccess,
} from "@/services/cutmeat-report-packages";

export const dynamic = "force-dynamic";

/**
 * Fase 2: "Paquete para el dueño". A diferencia de "Informes diarios"
 * (admin-only sin excepción), esta pantalla sí deja entrar a Gabriel (el
 * cliente de Cut Meat Distributors) en solo lectura -- por eso vive en
 * su propia ruta en vez de una pestaña de daily-reports.
 */
export default async function CutMeatPackagePage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { companyId } = await params;
  const { date } = await searchParams;
  const { company, canWrite } = await requirePackageAccess(companyId);

  const reportDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : await suggestReportDate(company.id);

  const [eligibility, versions] = await Promise.all([
    checkPackageEligibility(company.id, reportDate),
    getPackageVersions(company.id, reportDate),
  ]);

  return (
    <PackageWorkspace
      company={company}
      reportDate={reportDate}
      eligibility={eligibility}
      versions={versions}
      canWrite={canWrite}
    />
  );
}
