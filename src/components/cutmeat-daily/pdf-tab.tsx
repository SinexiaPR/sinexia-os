"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, FileDown, RefreshCw } from "lucide-react";

import { generateDailyPdf, type CutMeatPdfDocType } from "@/actions/cutmeat-daily";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { CutMeatGeneratedPdf } from "@/services/cutmeat-daily";

const docLabels: Record<CutMeatPdfDocType, string> = {
  reconciliation: "Reconciliation Report",
  bank: "Export del banco",
  consolidated: "Consolidated",
  vendors: "Aging Vendors",
  customers: "Aging Customers",
};

const docOrder: CutMeatPdfDocType[] = [
  "reconciliation",
  "bank",
  "consolidated",
  "vendors",
  "customers",
];

export function PdfTab({
  companyId,
  reportDate,
  generatedPdfs,
  hasReport,
}: {
  companyId: string;
  reportDate: string;
  generatedPdfs: CutMeatGeneratedPdf[];
  hasReport: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const regenerate = (docType: CutMeatPdfDocType) => {
    startTransition(async () => {
      const result = await generateDailyPdf({ companyId, reportDate, docType });
      setMessage("error" in result ? result.error ?? null : null);
      router.refresh();
    });
  };

  const byDoc = new Map<CutMeatPdfDocType, CutMeatGeneratedPdf[]>();
  for (const pdf of generatedPdfs) {
    const list = byDoc.get(pdf.docType) ?? [];
    list.push(pdf);
    byDoc.set(pdf.docType, list);
  }

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Los 5 PDF del día</h2>
            <p className="text-muted-foreground text-sm">
              Cada regeneración crea una versión nueva -- nunca se sobrescribe
              un PDF ya generado.
            </p>
          </div>
          <Button asChild variant="outline" disabled={!hasReport}>
            <a href={`/api/cutmeat-daily/${companyId}/pdf/zip?date=${reportDate}`}>
              <FileDown className="size-4" />
              Descargar ZIP de los 5
            </a>
          </Button>
        </div>
        {message ? <p className="text-muted-foreground mt-3 text-sm">{message}</p> : null}
      </SurfaceCard>

      <div className="grid gap-4 md:grid-cols-2">
        {docOrder.map((docType) => {
          const versions = (byDoc.get(docType) ?? []).sort((a, b) => b.version - a.version);
          const latest = versions[0];
          return (
            <SurfaceCard key={docType} padding="sm">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{docLabels[docType]}</h3>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || !hasReport}
                  onClick={() => regenerate(docType)}
                >
                  <RefreshCw className="size-4" />
                  {latest ? "Regenerar" : "Generar"}
                </Button>
              </div>
              {latest ? (
                <p className="text-muted-foreground mt-2 px-1 text-xs">
                  Última versión: v{latest.version} ·{" "}
                  {new Date(latest.generatedAt).toLocaleString("es-PR")}
                </p>
              ) : (
                <p className="text-muted-foreground mt-2 px-1 text-xs">
                  Todavía no se generó.
                </p>
              )}
              <div className="mt-2 space-y-1 px-1">
                {versions.map((pdf) => (
                  <a
                    key={pdf.id}
                    href={`/api/cutmeat-daily/${companyId}/pdf?date=${reportDate}&doc=${docType}&version=${pdf.version}`}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs"
                  >
                    <Download className="size-3.5" />v{pdf.version} ·{" "}
                    {new Date(pdf.generatedAt).toLocaleDateString("es-PR")}
                  </a>
                ))}
              </div>
            </SurfaceCard>
          );
        })}
      </div>
    </div>
  );
}
