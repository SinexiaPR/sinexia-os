"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
  Unlock,
} from "lucide-react";

import { closeDailyReport, ensureDailyReport, reopenDailyReport } from "@/actions/cutmeat-daily";
import { AgingTab } from "@/components/cutmeat-daily/aging-tab";
import { BankTab } from "@/components/cutmeat-daily/bank-tab";
import { IncomeTab } from "@/components/cutmeat-daily/income-tab";
import { PdfTab } from "@/components/cutmeat-daily/pdf-tab";
import { ReconciliationTab } from "@/components/cutmeat-daily/reconciliation-tab";
import { RecurringTab } from "@/components/cutmeat-daily/recurring-tab";
import { SettingsTab } from "@/components/cutmeat-daily/settings-tab";
import { SummaryTab } from "@/components/cutmeat-daily/summary-tab";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { UnderlineTabs } from "@/components/ui/underline-tabs";
import { addDays, type IsoDate } from "@/lib/cutmeat-daily/dates";
import type {
  CutMeatDailyReport,
  DailyReportWorkspace,
} from "@/services/cutmeat-daily";
import { cn } from "@/lib/utils";

type Company = { id: string; name: string; slug: string };
type Tab =
  | "resumen"
  | "conciliacion"
  | "banco"
  | "recurrentes"
  | "proyeccion"
  | "aging"
  | "configuracion"
  | "pdfs";

const tabs: Array<{ key: Tab; label: string }> = [
  { key: "resumen", label: "Resumen" },
  { key: "conciliacion", label: "Conciliación" },
  { key: "banco", label: "Banco" },
  { key: "recurrentes", label: "Recurrentes" },
  { key: "proyeccion", label: "THIS WEEK" },
  { key: "aging", label: "Aging" },
  { key: "configuracion", label: "Configuración" },
  { key: "pdfs", label: "PDFs" },
];

const statusLabels: Record<CutMeatDailyReport["status"], string> = {
  draft: "Borrador",
  closed: "Cerrado",
  reopened: "Reabierto",
};

export function CutMeatDailyWorkspace({
  company,
  reportDate,
  workspace,
  recentReports,
}: {
  company: Company;
  reportDate: IsoDate;
  workspace: DailyReportWorkspace;
  recentReports: CutMeatDailyReport[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("resumen");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const goToDate = (value: string) => {
    router.push(`/dashboard/admin/companies/${company.id}/daily-reports?date=${value}`);
  };

  const create = () => {
    startTransition(async () => {
      const result = await ensureDailyReport({ companyId: company.id, reportDate });
      if ("error" in result) {
        setMessage(result.error ?? null);
        return;
      }
      router.refresh();
    });
  };

  const close = () => {
    if (!workspace.report) return;
    startTransition(async () => {
      const result = await closeDailyReport({ companyId: company.id, reportId: workspace.report!.id });
      setMessage("error" in result ? result.error : "Día cerrado.");
      router.refresh();
    });
  };

  const reopen = () => {
    if (!workspace.report) return;
    startTransition(async () => {
      const result = await reopenDailyReport({ companyId: company.id, reportId: workspace.report!.id });
      setMessage("error" in result ? result.error : "Día reabierto.");
      router.refresh();
    });
  };

  if (!workspace.settings) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" className="-ml-3">
          <Link href={`/dashboard/admin/companies/${company.id}`}>
            <ArrowLeft className="size-4" />
            Volver a {company.name}
          </Link>
        </Button>
        <SurfaceCard>
          <p className="text-sm">
            Esta empresa todavía no tiene la configuración inicial de
            &quot;Informes diarios&quot; (proveedores, feriados, Prime
            Meats). Corré la migración de seed o configurala desde la
            pestaña Configuración una vez creado el primer informe.
          </p>
        </SurfaceCard>
      </div>
    );
  }

  const readOnly = workspace.report?.status === "closed";
  const blockingWarnings = workspace.warnings.filter((warning) => warning.severity === "blocking");
  const infoWarnings = workspace.warnings.filter((warning) => warning.severity === "info");

  return (
    <div className="space-y-5">
      <header className="space-y-5">
        <Button asChild variant="ghost" className="-ml-3">
          <Link href={`/dashboard/admin/companies/${company.id}`}>
            <ArrowLeft className="size-4" />
            Volver a {company.name}
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {company.name} · Informes diarios
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              {new Intl.DateTimeFormat("es", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(`${reportDate}T12:00:00Z`))}
            </h1>
            {workspace.report ? (
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  workspace.report.status === "closed"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : workspace.report.status === "reopened"
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-border text-muted-foreground",
                )}
              >
                {statusLabels[workspace.report.status]}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Día anterior"
              onClick={() => goToDate(addDays(reportDate, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <input
              type="date"
              value={reportDate}
              onChange={(event) => event.target.value && goToDate(event.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Día siguiente"
              onClick={() => goToDate(addDays(reportDate, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
            {!workspace.report ? (
              <Button disabled={pending} onClick={create}>
                Crear informe de este día
              </Button>
            ) : workspace.report.status === "closed" ? (
              <Button variant="outline" disabled={pending} onClick={reopen}>
                <Unlock className="size-4" />
                Reabrir
              </Button>
            ) : (
              <Button variant="outline" disabled={pending} onClick={close}>
                <Lock className="size-4" />
                Cerrar día
              </Button>
            )}
          </div>
        </div>
      </header>

      {blockingWarnings.length ? (
        <SurfaceCard padding="sm" className="border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3 px-1">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <ul className="space-y-1 text-sm text-amber-900">
              {blockingWarnings.map((warning) => (
                <li key={warning.message}>{warning.message}</li>
              ))}
            </ul>
          </div>
        </SurfaceCard>
      ) : null}

      {infoWarnings.length ? (
        <SurfaceCard padding="sm" className="border-sky-300 bg-sky-50">
          <div className="flex items-start gap-3 px-1">
            <Info className="mt-0.5 size-5 shrink-0 text-sky-700" />
            <ul className="space-y-1 text-sm text-sky-900">
              {infoWarnings.map((warning) => (
                <li key={warning.message}>{warning.message}</li>
              ))}
            </ul>
          </div>
        </SurfaceCard>
      ) : null}

      {message ? <p className="text-muted-foreground text-sm">{message}</p> : null}

      {readOnly ? (
        <p className="text-muted-foreground text-sm">
          Este día está cerrado. Reabrilo para poder editar los datos.
        </p>
      ) : null}

      <UnderlineTabs
        tabs={tabs.map((item) => ({
          label: item.label,
          active: tab === item.key,
          onSelect: () => setTab(item.key),
        }))}
      />

      {tab === "resumen" ? (
        <SummaryTab companyId={company.id} workspace={workspace} readOnly={readOnly} />
      ) : null}
      {tab === "conciliacion" ? (
        <ReconciliationTab
          companyId={company.id}
          reportId={workspace.report?.id ?? null}
          readOnly={readOnly}
          reconciliation={workspace.reconciliation}
        />
      ) : null}
      {tab === "banco" ? (
        <BankTab
          companyId={company.id}
          reportId={workspace.report?.id ?? null}
          readOnly={readOnly}
          bankExport={workspace.bankExport}
          movements={workspace.bankMovements}
          recurring={workspace.recurring}
        />
      ) : null}
      {tab === "recurrentes" ? (
        <RecurringTab
          companyId={company.id}
          reportDate={reportDate}
          recurring={workspace.recurring}
        />
      ) : null}
      {tab === "proyeccion" ? (
        <IncomeTab
          companyId={company.id}
          weekStart={workspace.weekStart}
          incomeDays={workspace.incomeDays}
          defaultDailyIncome={workspace.settings.defaultDailyIncome}
        />
      ) : null}
      {tab === "aging" ? (
        <AgingTab
          companyId={company.id}
          reportId={workspace.report?.id ?? null}
          readOnly={readOnly}
          vendorItems={workspace.vendorItems}
          vendorAging={workspace.vendorAging}
          customerItems={workspace.customerItems}
          customerAging={workspace.customerAging}
        />
      ) : null}
      {tab === "configuracion" ? (
        <SettingsTab
          companyId={company.id}
          vendorConfig={workspace.vendorConfig}
          holidays={workspace.holidays}
          settings={workspace.settings}
        />
      ) : null}
      {tab === "pdfs" ? (
        <PdfTab
          companyId={company.id}
          reportDate={reportDate}
          generatedPdfs={workspace.generatedPdfs}
          hasReport={Boolean(workspace.report)}
        />
      ) : null}

      <SurfaceCard padding="sm">
        <h2 className="px-1 text-base font-semibold">Informes recientes</h2>
        <div className="mt-2 flex flex-wrap gap-2 px-1">
          {recentReports.map((report) => (
            <Link
              key={report.id}
              href={`/dashboard/admin/companies/${company.id}/daily-reports?date=${report.reportDate}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                report.reportDate === reportDate
                  ? "border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {report.reportDate} · {statusLabels[report.status]}
            </Link>
          ))}
          {recentReports.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin informes previos.</p>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
