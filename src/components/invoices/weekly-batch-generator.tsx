"use client";

import { useMemo, useState, useTransition } from "react";

import {
  confirmWeeklyInvoiceBatch,
  getWeeklyInvoiceBatchPreview,
  type ConfirmBatchResult,
} from "@/actions/billing-batch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { WeeklyBatchPreviewLine } from "@/services/billing-batch";

function mostRecentMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const money = (value: number | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

type LineState = {
  included: boolean;
  amount: number | null;
  regenerate: boolean;
};

export function WeeklyBatchGenerator() {
  const [pending, startTransition] = useTransition();
  const [periodStart, setPeriodStart] = useState(mostRecentMonday());
  const periodEnd = useMemo(() => addDays(periodStart, 6), [periodStart]);
  const [lines, setLines] = useState<WeeklyBatchPreviewLine[] | null>(null);
  const [lineState, setLineState] = useState<Record<string, LineState>>({});
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ConfirmBatchResult[] | null>(null);
  const [downloading, setDownloading] = useState(false);

  const loadPreview = () => {
    setError(null);
    setResults(null);
    startTransition(async () => {
      const result = await getWeeklyInvoiceBatchPreview(periodStart, periodEnd);
      if ("error" in result) {
        setError(result.error);
        setLines(null);
        return;
      }
      setLines(result.lines);
      const initial: Record<string, LineState> = {};
      for (const line of result.lines) {
        initial[line.billingBatchClientId] = {
          included: !line.pendingAmount && !line.existingInvoice,
          amount: line.amount,
          regenerate: false,
        };
      }
      setLineState(initial);
    });
  };

  const updateLine = (id: string, patch: Partial<LineState>) =>
    setLineState((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const total = useMemo(() => {
    if (!lines) return 0;
    return lines.reduce((sum, line) => {
      const state = lineState[line.billingBatchClientId];
      if (!state?.included) return sum;
      return sum + (state.amount ?? 0);
    }, 0);
  }, [lines, lineState]);

  const confirm = () => {
    if (!lines) return;
    const selected = lines.filter((line) => lineState[line.billingBatchClientId]?.included);
    if (!selected.length) {
      setError("No hay ninguna línea marcada para generar.");
      return;
    }
    const recap = selected
      .map((line) => `${line.companyName}: ${money(lineState[line.billingBatchClientId].amount)}`)
      .join("\n");
    if (
      !window.confirm(
        `¿Generar ${selected.length} factura(s) por un total de ${money(total)}?\n\n${recap}`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const payload = selected.map((line) => {
        const state = lineState[line.billingBatchClientId];
        return {
          billingBatchClientId: line.billingBatchClientId,
          periodStart: line.periodStart,
          periodEnd: line.periodEnd,
          amountOverride: state.amount,
          cancelInvoiceId: state.regenerate ? (line.existingInvoice?.id ?? null) : null,
        };
      });
      const result = await confirmWeeklyInvoiceBatch(payload);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setResults(result.results);
      setLines(null);
    });
  };

  const downloadBatch = () => {
    if (!results) return;
    const invoiceIds = results.filter((r) => r.success && r.invoiceId).map((r) => r.invoiceId!);
    if (!invoiceIds.length) return;
    setDownloading(true);
    fetch("/api/invoices/batch-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceIds }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo descargar el lote.");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `facturas-lote-${periodStart}.zip`;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError("No se pudo descargar el lote."))
      .finally(() => setDownloading(false));
  };

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Periodo (semana) -- desde</span>
            <Input
              type="date"
              value={periodStart}
              onChange={(event) => {
                setPeriodStart(event.target.value);
                setLines(null);
                setResults(null);
              }}
            />
          </label>
          <p className="text-muted-foreground pb-2 text-sm">
            hasta <span className="font-medium">{periodEnd}</span> -- moneda USD
          </p>
          <Button onClick={loadPreview} disabled={pending}>
            Generar facturas de la semana
          </Button>
        </div>
        {error ? <p className="text-destructive mt-3 text-sm">{error}</p> : null}
      </SurfaceCard>

      {lines ? (
        <SurfaceCard padding="sm">
          <h3 className="px-1 text-base font-semibold">
            Vista previa -- {periodStart} a {periodEnd} (USD)
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead className="text-muted-foreground border-b text-xs uppercase">
                <tr>
                  <th className="px-3 py-2">Incluir</th>
                  <th>Cliente</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                  <th>N° estimado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const state = lineState[line.billingBatchClientId];
                  const alreadyInvoiced = Boolean(line.existingInvoice);
                  return (
                    <tr key={line.billingBatchClientId} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={state?.included ?? false}
                          disabled={line.pendingAmount || (alreadyInvoiced && !state?.regenerate)}
                          onChange={(event) =>
                            updateLine(line.billingBatchClientId, { included: event.target.checked })
                          }
                        />
                      </td>
                      <td className="font-medium">{line.companyName}</td>
                      <td>{line.lineDescription}</td>
                      <td>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 w-28"
                          disabled={line.pendingAmount}
                          value={state?.amount ?? ""}
                          onChange={(event) =>
                            updateLine(line.billingBatchClientId, {
                              amount: event.target.value ? Number(event.target.value) : null,
                            })
                          }
                        />
                      </td>
                      <td className="text-muted-foreground">
                        {line.estimatedNextNumber ? `#${line.estimatedNextNumber} (estimado)` : "—"}
                      </td>
                      <td>
                        {line.pendingAmount ? (
                          <span className="text-amber-600">Pendiente de monto</span>
                        ) : alreadyInvoiced ? (
                          <span className="flex items-center gap-2">
                            Ya facturado (#{line.existingInvoice?.invoiceNumber ?? "borrador"})
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `¿Regenerar la factura de ${line.companyName} para este periodo? La anterior quedará cancelada (su número no se reutiliza).`,
                                  )
                                )
                                  return;
                                updateLine(line.billingBatchClientId, {
                                  included: true,
                                  regenerate: true,
                                });
                              }}
                            >
                              Regenerar
                            </Button>
                          </span>
                        ) : (
                          <span className="text-emerald-600">Nueva</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-3 py-3">
            <p className="text-sm font-medium">Total del lote: {money(total)}</p>
            <Button onClick={confirm} disabled={pending}>
              Confirmar y generar
            </Button>
          </div>
        </SurfaceCard>
      ) : null}

      {results ? (
        <SurfaceCard padding="sm">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-semibold">Resultado del lote</h3>
            <Button onClick={downloadBatch} disabled={downloading} variant="outline">
              Descargar lote completo (.zip)
            </Button>
          </div>
          <ul className="mt-3 divide-y px-1">
            {results.map((result) => (
              <li key={result.billingBatchClientId} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {result.success
                    ? `Factura #${result.invoiceNumber} emitida correctamente`
                    : `Error: ${result.error}`}
                </span>
                {result.success && result.invoiceId ? (
                  <a
                    className="text-primary underline"
                    href={`/api/invoices/${result.invoiceId}/download`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Descargar PDF
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
