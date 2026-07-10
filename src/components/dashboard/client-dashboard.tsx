import Link from "next/link";
import { ArrowUpRight, FileText, Upload } from "lucide-react";

import { ClientNotificationAlerts } from "@/components/dashboard/client-notification-alerts";
import { Badge } from "@/components/ui/badge";
import { NotificationDot } from "@/components/ui/nav-badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  getCompanyById,
  getDocumentsForCompany,
  getSignedFileUrl,
} from "@/services/documents";
import { getLatestReportForCompany, getReportCreatedDatesForCompany } from "@/services/reports";
import {
  DOCUMENT_STATUS_LABELS,
  PENDING_STATUSES,
  type DocumentWithCompany,
  type Profile,
  type Report,
} from "@/types";

type ClientDashboardProps = {
  profile: Profile;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

async function LastUploadCard({ document }: { document: DocumentWithCompany }) {
  const signedUrl = await getSignedFileUrl(document.file_url);

  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium tracking-wide text-muted-foreground uppercase">
            Último envío
          </p>
          <p className="mt-4 text-xl font-semibold tracking-tight text-foreground">
            {document.supplier}
          </p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <FileText className="size-4 text-muted-foreground" />
        </div>
      </div>

      <div className="mt-auto space-y-4 pt-8">
        <div className="flex items-center gap-2">
          <Badge variant={document.status}>
            {DOCUMENT_STATUS_LABELS[document.status]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {document.document_type}
          </span>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(document.amount)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(document.created_at)}
            </p>
          </div>
          {signedUrl ? (
            <Link
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ver
              <ArrowUpRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </div>
    </SurfaceCard>
  );
}

function EmptyLastUploadCard() {
  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col">
      <p className="text-[13px] font-medium tracking-wide text-muted-foreground uppercase">
        Último envío
      </p>
      <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
          <FileText className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">
          Sin envíos aún
        </p>
        <p className="mt-1 max-w-[200px] text-sm text-muted-foreground">
          Su archivo más reciente aparecerá aquí.
        </p>
      </div>
    </SurfaceCard>
  );
}

function LatestReportCard({ report }: { report: Report | null }) {
  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col">
      <p className="text-[13px] font-medium tracking-wide text-muted-foreground uppercase">
        Último reporte
      </p>
      {report ? (
        <div className="mt-6 flex flex-1 flex-col">
          <p className="text-lg font-semibold tracking-tight text-foreground">
            {report.title}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {report.category} · {formatDate(report.created_at)}
          </p>
          <Link
            href="/dashboard/reports"
            className="mt-auto pt-8 text-sm font-medium text-primary hover:underline"
          >
            Ver reportes →
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Sin reportes aún
          </p>
          <p className="mt-1 max-w-[220px] text-sm leading-relaxed text-muted-foreground">
            Sinexia publicará reportes aquí cuando procese sus documentos.
          </p>
        </div>
      )}
    </SurfaceCard>
  );
}

function QuickUploadCard() {
  return (
    <Link href="/dashboard/inbox#upload" className="group block h-full">
      <SurfaceCard
        padding="lg"
        className="flex h-full flex-col border-primary/20 bg-primary/[0.03] transition-colors hover:border-primary/30 hover:bg-primary/[0.05]"
      >
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-transform group-hover:scale-105">
          <Upload className="size-5" />
        </div>
        <div className="mt-6">
          <p className="text-lg font-semibold tracking-tight text-foreground">
            Subir documento
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Envíe un archivo a su Inbox. Sinexia lo revisará — sin carpetas ni
            clasificaciones.
          </p>
        </div>
        <p className="mt-auto pt-8 text-sm font-medium text-primary">
          Subir ahora →
        </p>
      </SurfaceCard>
    </Link>
  );
}

export async function ClientDashboard({ profile }: ClientDashboardProps) {
  if (!profile.company_id) {
    return (
      <div className="space-y-2 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
        <p className="text-muted-foreground">
          Su cuenta no está vinculada a una empresa. Contacte a Sinexia.
        </p>
      </div>
    );
  }

  const [company, documents, latestReport, reportCreatedAts] = await Promise.all([
    getCompanyById(profile.company_id),
    getDocumentsForCompany(profile.company_id),
    getLatestReportForCompany(profile.company_id),
    getReportCreatedDatesForCompany(profile.company_id),
  ]);

  const pendingCount = documents.filter((doc) =>
    PENDING_STATUSES.includes(doc.status),
  ).length;
  const receivedCount = documents.filter((doc) => doc.status === "received").length;
  const reviewingCount = documents.filter((doc) => doc.status === "reviewing").length;

  const lastUpload = documents[0] ?? null;
  const firstName = profile.full_name?.split(" ")[0] ?? "cliente";

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {company?.name ?? "Su empresa"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Hola, {firstName}
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
          Suba documentos a su Inbox, consulte reportes de Sinexia o pregunte a
          SinexIA sobre los datos reales de su empresa.
        </p>
      </header>

      <ClientNotificationAlerts
        profileId={profile.id}
        pendingCount={reviewingCount}
        receivedCount={receivedCount}
        reportCreatedAts={reportCreatedAts}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SurfaceCard padding="lg" className="relative">
          {pendingCount > 0 ? (
            <span className="absolute top-6 right-6">
              <NotificationDot />
            </span>
          ) : null}
          <p className="text-[13px] font-medium tracking-wide text-muted-foreground uppercase">
            Pendientes
          </p>
          <p className="mt-6 text-5xl font-semibold tracking-tight tabular-nums">
            {pendingCount}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            En revisión por Sinexia
          </p>
        </SurfaceCard>

        <QuickUploadCard />

        {lastUpload ? (
          <LastUploadCard document={lastUpload} />
        ) : (
          <EmptyLastUploadCard />
        )}

        <LatestReportCard report={latestReport} />
      </div>
    </div>
  );
}
