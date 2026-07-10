"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Filter, Search, Trash2 } from "lucide-react";
import Link from "next/link";

import { deleteReport } from "@/actions/reports";
import { ReportCategoryDisplay } from "@/components/reports/report-category-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useIsReportViewed } from "@/hooks/use-unread-reports";
import { REPORT_CATEGORIES, getReportCategoryMeta } from "@/lib/constants/reports";
import {
  getReportsLastSeenAt,
  getViewedReportIds,
  markReportViewed,
  markReportsViewed,
} from "@/lib/notifications/viewed-reports";
import {
  formatDateEs,
  isSameDayOrAfter,
  isSameDayOrBefore,
  matchesSearch,
  sortReports,
  type ReportSort,
} from "@/lib/portal/format";
import { cn } from "@/lib/utils";
import type { Profile, ReportWithCompany } from "@/types";

type ReportCenterProps = {
  reports: ReportWithCompany[];
  profile: Profile;
  companies?: { id: string; name: string }[];
  signedUrls: Record<string, string | null>;
  highlightId?: string | null;
};

const selectClassName =
  "flex h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function isReportRead(
  profileId: string,
  report: ReportWithCompany,
): boolean {
  const viewed = getViewedReportIds(profileId);
  if (viewed.has(report.id)) return true;
  const lastSeen = getReportsLastSeenAt(profileId);
  if (!lastSeen) return false;
  return new Date(report.created_at).getTime() <= new Date(lastSeen).getTime();
}

function DeleteReportConfirm({ reportId }: { reportId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={isPending}
      className="size-10 shrink-0"
      aria-label="Eliminar reporte"
      onClick={() => {
        const confirmed = window.confirm(
          "¿Eliminar este reporte? El archivo también se eliminará.",
        );
        if (!confirmed) return;
        startTransition(async () => {
          await deleteReport(reportId);
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

function ClientReportItem({
  report,
  profileId,
  signedUrl,
  highlighted,
}: {
  report: ReportWithCompany;
  profileId: string;
  signedUrl: string | null;
  highlighted: boolean;
}) {
  const viewed = useIsReportViewed(profileId, report.id, report.created_at);
  const isNew = !viewed;

  return (
    <SurfaceCard
      id={`report-${report.id}`}
      padding="lg"
      className={cn(
        isNew && "border-primary/25 bg-navy-soft/30 ring-1 ring-primary/10",
        highlighted && "border-primary/40",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ReportCategoryDisplay category={report.category} variant="client" />
            {isNew ? (
              <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary-foreground uppercase">
                Nuevo
              </span>
            ) : (
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Leído
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {report.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            Periodo: {report.period}
          </p>
          <p className="text-sm text-muted-foreground">
            Publicado el {formatDateEs(report.created_at)}
          </p>
          {report.notes ? (
            <p className="border-t border-border/60 pt-3 text-sm leading-relaxed text-muted-foreground">
              {report.notes}
            </p>
          ) : null}
        </div>

        <div className="shrink-0">
          {signedUrl ? (
            <Link
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => markReportViewed(profileId, report.id)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground sm:h-11 sm:w-auto sm:min-w-[132px]"
            >
              <Download className="size-4" />
              Descargar
            </Link>
          ) : (
            <span className="inline-flex h-11 items-center text-sm text-muted-foreground">
              No disponible
            </span>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}

export function ReportCenter({
  reports,
  profile,
  companies = [],
  signedUrls,
  highlightId,
}: ReportCenterProps) {
  const isAdmin = profile.role === "admin";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [period, setPeriod] = useState("all");
  const [companyId, setCompanyId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "new" | "read">("all");
  const [sort, setSort] = useState<ReportSort>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [readTick, setReadTick] = useState(0);

  useEffect(() => {
    const bump = () => setReadTick((n) => n + 1);
    window.addEventListener("storage", bump);
    window.addEventListener("sinexia:reports-seen", bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener("sinexia:reports-seen", bump);
    };
  }, []);

  const periods = useMemo(() => {
    return [...new Set(reports.map((r) => r.period).filter(Boolean))].sort();
  }, [reports]);

  const filtered = useMemo(() => {
    void readTick;
    const list = reports.filter((report) => {
      if (!matchesSearch(report.title, query)) return false;
      if (category !== "all" && report.category !== category) return false;
      if (period !== "all" && report.period !== period) return false;
      if (companyId !== "all" && report.company_id !== companyId) return false;
      if (!isSameDayOrAfter(report.created_at, dateFrom)) return false;
      if (!isSameDayOrBefore(report.created_at, dateTo)) return false;

      if (!isAdmin && readFilter !== "all") {
        const read = isReportRead(profile.id, report);
        if (readFilter === "new" && read) return false;
        if (readFilter === "read" && !read) return false;
      }

      return true;
    });
    return sortReports(list, sort);
  }, [
    reports,
    query,
    category,
    period,
    companyId,
    dateFrom,
    dateTo,
    sort,
    isAdmin,
    readFilter,
    profile.id,
    readTick,
  ]);

  const companyScopedUrls = useMemo(() => {
    return filtered
      .map((report) => signedUrls[report.id])
      .filter((url): url is string => Boolean(url));
  }, [filtered, signedUrls]);

  const filterControls = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="rep-category">Categoría</Label>
        <select
          id="rep-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={selectClassName}
        >
          <option value="all">Todas</option>
          {REPORT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {getReportCategoryMeta(cat)?.clientLabel ?? cat}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rep-period">Periodo</Label>
        <select
          id="rep-period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className={selectClassName}
        >
          <option value="all">Todos</option>
          {periods.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {isAdmin ? (
        <div className="space-y-2">
          <Label htmlFor="rep-company">Empresa</Label>
          <select
            id="rep-company"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className={selectClassName}
          >
            <option value="all">Todas</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="rep-read">Estado de lectura</Label>
          <select
            id="rep-read"
            value={readFilter}
            onChange={(e) =>
              setReadFilter(e.target.value as "all" | "new" | "read")
            }
            className={selectClassName}
          >
            <option value="all">Todos</option>
            <option value="new">Nuevos</option>
            <option value="read">Leídos</option>
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="rep-from">Desde</Label>
        <Input
          id="rep-from"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-11 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rep-to">Hasta</Label>
        <Input
          id="rep-to"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-11 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rep-sort">Orden</Label>
        <select
          id="rep-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as ReportSort)}
          className={selectClassName}
        >
          <option value="newest">Más recientes</option>
          <option value="oldest">Más antiguos</option>
          <option value="title">Título</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título…"
            className="h-12 rounded-xl pl-10 text-base sm:h-11 sm:text-sm"
            aria-label="Buscar reportes"
          />
        </div>

        {!isAdmin && companyScopedUrls.length > 1 ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 gap-2 rounded-xl sm:h-11"
            onClick={() => {
              markReportsViewed(
                profile.id,
                filtered.map((r) => r.id),
              );
              for (const url of companyScopedUrls) {
                window.open(url, "_blank", "noopener,noreferrer");
              }
            }}
          >
            <Download className="size-4" />
            Descargar todos
          </Button>
        ) : null}

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-12 gap-2 rounded-xl sm:hidden"
            >
              <Filter className="size-4" />
              Filtros
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-5"
          >
            <SheetHeader className="mb-4 text-left">
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            {filterControls}
            <Button
              type="button"
              className="mt-6 h-12 w-full rounded-xl"
              onClick={() => setFiltersOpen(false)}
            >
              Aplicar
            </Button>
          </SheetContent>
        </Sheet>
      </div>

      <SurfaceCard padding="md" className="hidden sm:block">
        {filterControls}
      </SurfaceCard>

      <p className="text-sm text-muted-foreground">
        {filtered.length} reporte{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <SurfaceCard padding="lg">
          <div className="py-12 text-center">
            <p className="font-medium text-foreground">Sin reportes</p>
            <p className="mt-2 text-sm text-muted-foreground">
              No hay resultados con los filtros actuales.
            </p>
          </div>
        </SurfaceCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) =>
            isAdmin ? (
              <SurfaceCard
                key={report.id}
                id={`report-${report.id}`}
                padding="md"
                className={cn(
                  highlightId === report.id &&
                    "border-primary/30 ring-1 ring-primary/20",
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-foreground">{report.title}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-medium text-primary">
                        {report.company?.name ?? "—"}
                      </span>
                      <span aria-hidden>·</span>
                      <ReportCategoryDisplay
                        category={report.category}
                        variant="admin"
                        className="inline-flex [&_p]:normal-case [&_p]:text-sm [&_p]:text-muted-foreground [&_p]:tracking-normal"
                      />
                      <span aria-hidden>·</span>
                      <span>{report.period}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Publicado el {formatDateEs(report.created_at)}
                    </p>
                    {report.notes ? (
                      <p className="pt-2 text-sm leading-relaxed text-muted-foreground">
                        {report.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {signedUrls[report.id] ? (
                      <Link
                        href={signedUrls[report.id]!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center rounded-xl border border-border px-3 text-sm font-medium text-primary hover:bg-muted/50"
                      >
                        Descargar
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No disponible
                      </span>
                    )}
                    <DeleteReportConfirm reportId={report.id} />
                  </div>
                </div>
              </SurfaceCard>
            ) : (
              <ClientReportItem
                key={report.id}
                report={report}
                profileId={profile.id}
                signedUrl={signedUrls[report.id] ?? null}
                highlighted={highlightId === report.id}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
