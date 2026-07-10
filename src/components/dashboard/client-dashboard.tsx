import Link from "next/link";
import { BarChart3, FileText, Upload } from "lucide-react";

import { LatestReportsSection } from "@/components/dashboard/latest-reports-section";
import { NewReportsMetricCard } from "@/components/dashboard/new-reports-metric";
import { ContactSinexiaCard } from "@/components/contact/contact-sinexia-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatDateEs, formatDateTimeEs } from "@/lib/portal/format";
import {
  getCompanyById,
  getDocumentsForCompany,
} from "@/services/documents";
import {
  getReportsForCompany,
  getSignedReportFileUrl,
} from "@/services/reports";
import {
  DOCUMENT_STATUS_LABELS,
  PENDING_STATUSES,
  type DocumentWithCompany,
  type Profile,
  type ReportWithCompany,
} from "@/types";

type ClientDashboardProps = {
  profile: Profile;
};

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  href: string;
};

function buildActivity(
  documents: DocumentWithCompany[],
  reports: ReportWithCompany[],
): ActivityItem[] {
  const docItems: ActivityItem[] = documents.slice(0, 8).map((doc) => ({
    id: `doc-${doc.id}`,
    title:
      doc.status === "received"
        ? "Documento enviado"
        : "Estado de documento actualizado",
    description: `${doc.supplier} · ${DOCUMENT_STATUS_LABELS[doc.status]}`,
    timestamp: doc.updated_at || doc.created_at,
    href: `/dashboard/inbox?doc=${doc.id}`,
  }));

  const reportItems: ActivityItem[] = reports.slice(0, 8).map((report) => ({
    id: `report-${report.id}`,
    title: "Reporte publicado",
    description: `${report.title} · ${report.period}`,
    timestamp: report.created_at,
    href: `/dashboard/reports?report=${report.id}`,
  }));

  return [...docItems, ...reportItems]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 6);
}

export async function ClientDashboard({ profile }: ClientDashboardProps) {
  if (!profile.company_id) {
    return (
      <div className="space-y-2 py-12">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Inicio
        </h1>
        <p className="text-muted-foreground">
          Su cuenta no está vinculada a una empresa. Contacte a Sinexia.
        </p>
        <div className="pt-6">
          <ContactSinexiaCard />
        </div>
      </div>
    );
  }

  const [company, documents, reports] = await Promise.all([
    getCompanyById(profile.company_id),
    getDocumentsForCompany(profile.company_id),
    getReportsForCompany(profile.company_id),
  ]);

  const pendingDocs = documents.filter((doc) =>
    PENDING_STATUSES.includes(doc.status),
  );
  const companyName = company?.name ?? "su empresa";
  const latestReports = reports.slice(0, 3);
  const activity = buildActivity(documents, reports);

  const signedReportUrls: Record<string, string | null> = {};
  await Promise.all(
    latestReports.map(async (report) => {
      signedReportUrls[report.id] = await getSignedReportFileUrl(report.file_url);
    }),
  );

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="space-y-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Hola, {companyName}
        </h1>
        <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Resumen operativo de documentos y reportes de su empresa.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SurfaceCard padding="md">
          <p className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Documentos enviados
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
            {documents.length}
          </p>
        </SurfaceCard>
        <SurfaceCard padding="md">
          <p className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Pendientes de revisión
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
            {pendingDocs.length}
          </p>
        </SurfaceCard>
        <SurfaceCard padding="md">
          <p className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Reportes disponibles
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
            {reports.length}
          </p>
        </SurfaceCard>
        <NewReportsMetricCard
          profileId={profile.id}
          reports={reports.map((r) => ({ id: r.id, created_at: r.created_at }))}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          asChild
          size="lg"
          className="h-12 rounded-xl text-[15px] font-semibold sm:min-w-[200px]"
        >
          <Link href="/dashboard/inbox#upload" className="gap-2">
            <Upload className="size-4" />
            Enviar documento
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-12 rounded-xl bg-card text-[15px] font-medium sm:min-w-[160px]"
        >
          <Link href="/dashboard/reports" className="gap-2">
            <BarChart3 className="size-4" />
            Ver reportes
          </Link>
        </Button>
      </div>

      <LatestReportsSection
        reports={latestReports}
        profileId={profile.id}
        signedUrls={signedReportUrls}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SurfaceCard padding="md">
          <h2 className="text-base font-semibold tracking-tight">
            Actividad reciente
          </h2>
          {activity.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Aún no hay actividad.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {activity.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-start gap-3 rounded-xl border border-border/70 px-3 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy-soft text-primary">
                    {item.id.startsWith("report") ? (
                      <BarChart3 className="size-4" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground">{item.title}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDateTimeEs(item.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard padding="md">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight">
              Pendientes
            </h2>
            <Link
              href="/dashboard/inbox"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver documentos
            </Link>
          </div>
          {pendingDocs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay documentos pendientes.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-border/60">
              {pendingDocs.slice(0, 6).map((doc) => (
                <Link
                  key={doc.id}
                  href={`/dashboard/inbox?doc=${doc.id}`}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {doc.supplier}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Factura {doc.invoice_number} · {formatDateEs(doc.created_at)}
                    </p>
                  </div>
                  <Badge variant={doc.status}>
                    {DOCUMENT_STATUS_LABELS[doc.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>

      <ContactSinexiaCard />
    </div>
  );
}
