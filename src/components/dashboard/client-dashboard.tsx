import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Upload } from "lucide-react";

import { ClientNotificationAlerts } from "@/components/dashboard/client-notification-alerts";
import { ContactSinexiaCard } from "@/components/contact/contact-sinexia-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotificationDot } from "@/components/ui/nav-badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  getCompanyById,
  getDocumentsForCompany,
  getSignedFileUrl,
} from "@/services/documents";
import {
  getLatestReportForCompany,
  getReportCreatedDatesForCompany,
} from "@/services/reports";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  PENDING_STATUSES,
  type DocumentType,
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

function documentTypeLabel(type: string) {
  return DOCUMENT_TYPE_LABELS[type as DocumentType] ?? type;
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
        <div className="flex size-10 items-center justify-center rounded-xl bg-navy-soft text-primary">
          <FileText className="size-4" />
        </div>
      </div>

      <div className="mt-auto space-y-4 pt-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={document.status}>
            {DOCUMENT_STATUS_LABELS[document.status]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {documentTypeLabel(document.document_type)}
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
              className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Ver archivo
              <ArrowRight className="size-3.5" />
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
        <div className="flex size-12 items-center justify-center rounded-2xl bg-navy-soft text-primary">
          <FileText className="size-5" />
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

  const [company, documents, latestReport, reportCreatedAts] =
    await Promise.all([
      getCompanyById(profile.company_id),
      getDocumentsForCompany(profile.company_id),
      getLatestReportForCompany(profile.company_id),
      getReportCreatedDatesForCompany(profile.company_id),
    ]);

  const pendingCount = documents.filter((doc) =>
    PENDING_STATUSES.includes(doc.status),
  ).length;
  const receivedCount = documents.filter(
    (doc) => doc.status === "received",
  ).length;
  const reviewingCount = documents.filter(
    (doc) => doc.status === "reviewing",
  ).length;
  const reportsAvailable = reportCreatedAts.length;

  const lastUpload = documents[0] ?? null;
  const firstName = profile.full_name?.split(" ")[0] ?? "cliente";
  const companyName = company?.name ?? "su empresa";

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">{companyName}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Bienvenido, {firstName}
        </h1>
        <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Envíe documentos, consulte reportes y manténgase al día con el estado
          de {companyName}.
        </p>
      </header>

      <ClientNotificationAlerts
        profileId={profile.id}
        pendingCount={reviewingCount}
        receivedCount={receivedCount}
        reportCreatedAts={reportCreatedAts}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SurfaceCard padding="md" className="relative">
          <p className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Documentos enviados
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
            {documents.length}
          </p>
        </SurfaceCard>

        <SurfaceCard padding="md" className="relative">
          {pendingCount > 0 ? (
            <span className="absolute top-5 right-5">
              <NotificationDot />
            </span>
          ) : null}
          <p className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Pendientes de revisión
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
            {pendingCount}
          </p>
        </SurfaceCard>

        <SurfaceCard padding="md" className="relative">
          <p className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            Reportes disponibles
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">
            {reportsAvailable}
          </p>
        </SurfaceCard>
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

      <div className="grid gap-4 sm:grid-cols-2">
        {lastUpload ? (
          <LastUploadCard document={lastUpload} />
        ) : (
          <EmptyLastUploadCard />
        )}
        <LatestReportCard report={latestReport} />
      </div>

      <ContactSinexiaCard />
    </div>
  );
}
