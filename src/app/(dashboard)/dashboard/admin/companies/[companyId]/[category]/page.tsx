import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { DocumentList } from "@/components/dashboard/document-list";
import { AdminReportsList } from "@/components/reports/admin-reports-list";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAdmin } from "@/lib/auth/session";
import {
  getViewedDocumentIds,
  getViewedReportIds,
} from "@/services/notifications";
import {
  getAdminCompanyCategoryDetail,
  getAdminCompanyReportIntelligence,
} from "@/services/company-workspace";

export const dynamic = "force-dynamic";

function extension(path: string) {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

export default async function AdminCompanyCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireAdmin();
  const { companyId, category } = await params;
  const filters = await searchParams;
  const value = (key: string) =>
    typeof filters[key] === "string" ? filters[key] : "";
  const detail = await getAdminCompanyCategoryDetail(companyId, category);
  if (!detail) notFound();
  const date = value("date");
  const status = value("status");
  const priority = value("priority");
  const format = value("format");
  const source = value("source");
  const documents = detail.documents.filter(
    (item) =>
      (!date || item.created_at.slice(0, 10) === date) &&
      (!status || item.status === status) &&
      (!priority || item.priority === priority) &&
      (!format || extension(item.file_url) === format) &&
      (!source || source === "document"),
  );
  const reports = detail.reports.filter(
    (item) =>
      (!date || item.created_at.slice(0, 10) === date) &&
      (!format || extension(item.file_url) === format) &&
      (!source || source === "report"),
  );
  const [viewedDocumentIds, viewedReportIds, intelligence] = await Promise.all([
    getViewedDocumentIds(profile.id),
    getViewedReportIds(profile.id),
    getAdminCompanyReportIntelligence(
      companyId,
      reports.map((item) => item.id),
    ),
  ]);
  const selectClass =
    "h-9 rounded-md border border-input bg-background px-3 text-sm";
  const empty = documents.length === 0 && reports.length === 0;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Button asChild variant="ghost" className="-ml-3">
          <Link href={`/dashboard/admin/companies/${detail.company.id}`}>
            <ArrowLeft className="size-4" />
            Volver a {detail.company.name}
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {detail.company.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {detail.category.label}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Documentos y reportes de esta categoría, aislados por empresa.
            </p>
          </div>
          {detail.category.slug === "payroll" ? (
            <Button asChild>
              <Link href={`/dashboard/payroll?company=${detail.company.id}`}>
                Empleados, tarifas y nóminas semanales
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <SurfaceCard padding="sm">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-muted-foreground text-xs">
            Fecha
            <input
              name="date"
              type="date"
              defaultValue={date}
              className={`${selectClass} mt-1 w-full`}
            />
          </label>
          <label className="text-muted-foreground text-xs">
            Estado
            <select
              name="status"
              defaultValue={status}
              className={`${selectClass} mt-1 w-full`}
            >
              <option value="">Todos</option>
              <option value="received">Pendiente</option>
              <option value="reviewing">En revisión</option>
              <option value="processed">Procesado</option>
              <option value="rejected">Falta información</option>
            </select>
          </label>
          <label className="text-muted-foreground text-xs">
            Prioridad
            <select
              name="priority"
              defaultValue={priority}
              className={`${selectClass} mt-1 w-full`}
            >
              <option value="">Todas</option>
              <option value="routine">Rutina</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
          <label className="text-muted-foreground text-xs">
            Formato
            <select
              name="format"
              defaultValue={format}
              className={`${selectClass} mt-1 w-full`}
            >
              <option value="">Todos</option>
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel</option>
              <option value="xls">Excel clásico</option>
              <option value="csv">CSV</option>
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
            </select>
          </label>
          <label className="text-muted-foreground text-xs">
            Origen
            <select
              name="source"
              defaultValue={source}
              className={`${selectClass} mt-1 w-full`}
            >
              <option value="">Documentos y reportes</option>
              <option value="document">Documentos</option>
              <option value="report">Reportes</option>
            </select>
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
            <Button type="submit" size="sm">
              Aplicar filtros
            </Button>
            <Button asChild type="button" size="sm" variant="ghost">
              <Link
                href={`/dashboard/admin/companies/${detail.company.id}/${detail.category.slug}`}
              >
                Limpiar
              </Link>
            </Button>
          </div>
        </form>
      </SurfaceCard>

      {empty ? (
        <SurfaceCard>
          <p className="text-muted-foreground py-8 text-center text-sm">
            No hay archivos disponibles para esta categoría y filtros.
          </p>
        </SurfaceCard>
      ) : null}
      {documents.length ? (
        <DocumentList
          documents={documents}
          title={`Documentos · ${detail.category.label}`}
          showCompany
          viewedDocumentIds={viewedDocumentIds}
          profileId={profile.id}
          isAdmin
          emptyMessage="No hay documentos en esta categoría."
        />
      ) : null}
      {reports.length ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            Reportes · {detail.category.label}
          </h2>
          <AdminReportsList
            reports={reports}
            processingByReportId={intelligence.processing}
            profilesByReportId={intelligence.profiles}
            viewedReportIds={viewedReportIds}
            showFileMetadata
          />
        </section>
      ) : null}
    </div>
  );
}
