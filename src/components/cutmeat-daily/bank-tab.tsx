"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Plus, Trash2, Upload } from "lucide-react";

import { extractBankExportPdf, saveBankExport } from "@/actions/cutmeat-daily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatDayLabel } from "@/lib/cutmeat-daily/dates";
import type { RecurringPayment } from "@/lib/cutmeat-daily/calculations";

const selectClass =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px]";

type Movement = {
  id?: string;
  description: string;
  amount: string;
  direction: "ingreso" | "egreso";
  linkedRecurringId: string;
  isNotEnteredDeposit: boolean;
  note: string;
};

export function BankTab({
  companyId,
  reportId,
  readOnly,
  bankExport,
  movements: initialMovements,
  recurring,
}: {
  companyId: string;
  reportId: string | null;
  readOnly: boolean;
  bankExport: { closingBalance: number | null } | null;
  movements: Array<{
    id: string;
    description: string;
    amount: number;
    direction: "ingreso" | "egreso";
    linkedRecurringId?: string | null;
    isNotEnteredDeposit?: boolean;
  }>;
  recurring: RecurringPayment[];
}) {
  const [closingBalance, setClosingBalance] = useState(
    bankExport?.closingBalance != null ? String(bankExport.closingBalance) : "",
  );
  const [movements, setMovements] = useState<Movement[]>(
    initialMovements.map((m) => ({
      id: m.id,
      description: m.description,
      amount: String(m.amount),
      direction: m.direction,
      linkedRecurringId: m.linkedRecurringId ?? "",
      isNotEnteredDeposit: Boolean(m.isNotEnteredDeposit),
      note: "",
    })),
  );
  const [sourcePdfPath, setSourcePdfPath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const update = (index: number, patch: Partial<Movement>) => {
    setMovements((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const onUpload = (file: File | undefined) => {
    if (!file) return;
    setExtracting(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("companyId", companyId);
    formData.set("file", file);
    startTransition(async () => {
      const result = await extractBankExportPdf(formData);
      setExtracting(false);
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      if (result.closingBalance != null) setClosingBalance(String(result.closingBalance));
      setMovements(
        result.movements.map((m) => ({
          description: m.description,
          amount: String(m.amount),
          direction: m.direction,
          linkedRecurringId: "",
          isNotEnteredDeposit: false,
          note: "",
        })),
      );
      setSourcePdfPath(result.sourcePdfPath);
      setMessage("PDF leído -- revisá los movimientos antes de guardar.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  const save = () => {
    if (!reportId) {
      setMessage("Primero creá el informe de este día.");
      return;
    }
    const prepared = movements.filter((m) => m.description.trim() && Number(m.amount) > 0);
    startTransition(async () => {
      const result = await saveBankExport({
        companyId,
        reportId,
        closingBalance: closingBalance ? Number(closingBalance) : null,
        movements: prepared.map((m) => ({
          id: m.id,
          description: m.description.trim(),
          amount: Number(m.amount),
          direction: m.direction,
          linkedRecurringId: m.linkedRecurringId || null,
          isNotEnteredDeposit: m.isNotEnteredDeposit,
          note: m.note.trim() || null,
        })),
        sourcePdfPath,
      });
      setMessage("error" in result ? result.error : "Export del banco guardado.");
      if (!("error" in result)) router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-semibold">Deposit Accounts Activity Summary</h2>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={readOnly}
              onChange={(event) => onUpload(event.target.files?.[0])}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={readOnly || extracting}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              {extracting ? "Leyendo PDF…" : "Subir PDF del export del banco"}
            </Button>
          </div>
        </div>
        <label className="mt-4 block max-w-xs space-y-1 text-sm">
          <span className="text-muted-foreground text-xs">Closing balance</span>
          <Input
            inputMode="decimal"
            value={closingBalance}
            disabled={readOnly}
            onChange={(event) => setClosingBalance(event.target.value)}
          />
        </label>
      </SurfaceCard>

      <SurfaceCard padding="sm">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base font-semibold">Movimientos</h3>
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={() =>
              setMovements((current) => [
                ...current,
                {
                  description: "",
                  amount: "",
                  direction: "egreso",
                  linkedRecurringId: "",
                  isNotEnteredDeposit: false,
                  note: "",
                },
              ])
            }
          >
            <Plus className="size-4" />
            Agregar movimiento
          </Button>
        </div>
        <div className="mt-3 space-y-3 px-1">
          {movements.map((movement, index) => (
            <div
              key={movement.id ?? `new-${index}`}
              className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6"
            >
              <Input
                className="sm:col-span-2"
                placeholder="Descripción"
                value={movement.description}
                disabled={readOnly}
                onChange={(event) => update(index, { description: event.target.value })}
              />
              <Input
                inputMode="decimal"
                placeholder="Monto"
                value={movement.amount}
                disabled={readOnly}
                onChange={(event) => update(index, { amount: event.target.value })}
              />
              <select
                className={selectClass}
                value={movement.direction}
                disabled={readOnly}
                onChange={(event) =>
                  update(index, { direction: event.target.value as "ingreso" | "egreso" })
                }
              >
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
              </select>
              <select
                className={selectClass}
                value={movement.linkedRecurringId}
                disabled={readOnly}
                onChange={(event) => update(index, { linkedRecurringId: event.target.value })}
              >
                <option value="">Sin vincular a recurrente…</option>
                {recurring.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.concept} ({formatDayLabel(item.dueDate)})
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={movement.isNotEnteredDeposit}
                  disabled={readOnly}
                  onChange={(event) =>
                    update(index, { isNotEnteredDeposit: event.target.checked })
                  }
                />
                Not entered Sales
              </label>
              <button
                type="button"
                aria-label="Eliminar"
                disabled={readOnly}
                className="text-muted-foreground hover:text-destructive justify-self-end p-1"
                onClick={() => setMovements(movements.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {movements.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin movimientos cargados.</p>
          ) : null}
        </div>
      </SurfaceCard>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending || readOnly}>
          Guardar export del banco
        </Button>
        {message ? <span className="text-muted-foreground text-sm">{message}</span> : null}
      </div>
    </div>
  );
}
