"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, Check, Download, ImageIcon, RefreshCw } from "lucide-react";

import { markSentToOwner } from "@/actions/cutmeat-report-packages";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { addDays } from "@/lib/cutmeat-daily/dates";
import type { PackageEligibility } from "@/services/cutmeat-report-packages";
import type { CutMeatReportPackage } from "@/services/cutmeat-report-packages";

type Company = { id: string; name: string; slug: string };

export function PackageWorkspace({
  company,
  reportDate,
  eligibility,
  versions,
  canWrite,
}: {
  company: Company;
  reportDate: string;
  eligibility: PackageEligibility;
  versions: CutMeatReportPackage[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const goToDate = (value: string) => {
    router.push(`/dashboard/admin/companies/${company.id}/paquete-dueno?date=${value}`);
  };

  const generate = () => {
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/cutmeat-reports/${company.id}/${reportDate}/package/pdf`,
          { method: "POST" },
        );
        const body = (await response.json()) as { error?: string };
        if (!response.ok) {
          setMessage(body.error ?? "No se pudo generar el paquete.");
          return;
        }
        setMessage("Paquete generado.");
        router.refresh();
      } catch {
        setMessage("No se pudo generar el paquete.");
      }
    });
  };

  const markSent = (packageId: string) => {
    startTransition(async () => {
      const result = await markSentToOwner({ companyId: company.id, packageId, reportDate });
      setMessage("error" in result ? result.error ?? null : "Marcado como enviado al dueño.");
      router.refresh();
    });
  };

  const latest = versions[0];

  return (
    <div className="space-y-8">
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
              {company.name} · Paquete para el dueño
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">{reportDate}</h1>
            {!canWrite ? (
              <p className="text-muted-foreground mt-2 text-sm">Modo de solo lectura.</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => goToDate(addDays(reportDate, -1))}>
              Día anterior
            </Button>
            <input
              type="date"
              value={reportDate}
              onChange={(event) => event.target.value && goToDate(event.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
            />
            <Button variant="outline" onClick={() => goToDate(addDays(reportDate, 1))}>
              Día siguiente
            </Button>
          </div>
        </div>
      </header>

      {!eligibility.eligible ? (
        <SurfaceCard padding="sm" className="border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3 px-1">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div className="text-sm text-amber-900">
              <p className="font-medium">
                El paquete no se puede generar todavía para este día:
              </p>
              <ul className="mt-1 list-disc pl-4">
                {eligibility.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      {canWrite ? (
        <SurfaceCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                {latest ? "Regenerar paquete" : "Generar paquete"}
              </h2>
              <p className="text-muted-foreground text-sm">
                Un solo PDF con los 5 informes, portada con las cifras
                resaltadas primero. Cada generación crea una versión nueva.
              </p>
            </div>
            <Button disabled={pending || !eligibility.eligible} onClick={generate}>
              <RefreshCw className="size-4" />
              {latest ? "Regenerar" : "Generar"}
            </Button>
          </div>
          {message ? <p className="text-muted-foreground mt-3 text-sm">{message}</p> : null}
        </SurfaceCard>
      ) : message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}

      <SurfaceCard padding="sm">
        <h2 className="px-1 text-base font-semibold">Versiones ({versions.length})</h2>
        <div className="mt-3 space-y-3 px-1">
          {versions.map((pkg) => (
            <div
              key={pkg.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="text-sm">
                <p className="font-medium">
                  v{pkg.version}
                  {pkg.sentToOwner ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                      <Check className="size-3" />
                      Enviado al dueño
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {new Date(pkg.generatedAt).toLocaleString("es-PR")} · hash{" "}
                  {pkg.contentHash.slice(0, 10)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`/api/cutmeat-reports/${company.id}/${reportDate}/package/pdf?version=${pkg.version}`}
                  >
                    <Download className="size-4" />
                    PDF
                  </a>
                </Button>
                {pkg.coverImagePath ? (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={`/api/cutmeat-reports/${company.id}/${reportDate}/package/cover?version=${pkg.version}`}
                    >
                      <ImageIcon className="size-4" />
                      Portada (imagen)
                    </a>
                  </Button>
                ) : null}
                {canWrite && !pkg.sentToOwner ? (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => markSent(pkg.id)}>
                    Marcar enviado al dueño
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {versions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Todavía no se generó ningún paquete para este día.
            </p>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
