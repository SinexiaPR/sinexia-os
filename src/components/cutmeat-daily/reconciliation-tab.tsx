"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Plus, Trash2, Upload } from "lucide-react";

import { extractReconciliationPdf, saveReconciliation } from "@/actions/cutmeat-daily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatMoney } from "@/lib/cutmeat-daily/format";

type Item = { itemType: "uncleared_check" | "uncleared_deposit"; reference: string; amount: string };

export function ReconciliationTab({
  companyId,
  reportId,
  readOnly,
  reconciliation,
}: {
  companyId: string;
  reportId: string | null;
  readOnly: boolean;
  reconciliation: {
    statementEnding: number;
    register: number;
    unclearedChecks: Array<{ reference: string; amount: number }>;
    unclearedDeposits: Array<{ reference: string; amount: number }>;
  } | null;
}) {
  const [statementEnding, setStatementEnding] = useState(
    reconciliation ? String(reconciliation.statementEnding) : "",
  );
  const [register, setRegister] = useState(reconciliation ? String(reconciliation.register) : "");
  const [checks, setChecks] = useState<Item[]>(
    (reconciliation?.unclearedChecks ?? []).map((item) => ({
      itemType: "uncleared_check" as const,
      reference: item.reference,
      amount: String(item.amount),
    })),
  );
  const [deposits, setDeposits] = useState<Item[]>(
    (reconciliation?.unclearedDeposits ?? []).map((item) => ({
      itemType: "uncleared_deposit" as const,
      reference: item.reference,
      amount: String(item.amount),
    })),
  );
  const [sourcePdfPath, setSourcePdfPath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const onUpload = (file: File | undefined) => {
    if (!file) return;
    setExtracting(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("companyId", companyId);
    formData.set("file", file);
    startTransition(async () => {
      const result = await extractReconciliationPdf(formData);
      setExtracting(false);
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      if (result.statementEnding != null) setStatementEnding(String(result.statementEnding));
      if (result.register != null) setRegister(String(result.register));
      setChecks(
        result.unclearedChecks.map((item) => ({
          itemType: "uncleared_check" as const,
          reference: item.reference,
          amount: String(item.amount),
        })),
      );
      setDeposits(
        result.unclearedDeposits.map((item) => ({
          itemType: "uncleared_deposit" as const,
          reference: item.reference,
          amount: String(item.amount),
        })),
      );
      setSourcePdfPath(result.sourcePdfPath);
      setMessage("PDF leído -- revisá los datos antes de guardar.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  const checksTotal = checks.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const depositsTotal = deposits.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const control =
    (Number(statementEnding) || 0) + checksTotal + depositsTotal - (Number(register) || 0);

  const save = () => {
    if (!reportId) {
      setMessage("Primero creá el informe de este día.");
      return;
    }
    startTransition(async () => {
      const result = await saveReconciliation({
        companyId,
        reportId,
        statementEnding: Number(statementEnding) || 0,
        register: Number(register) || 0,
        items: [...checks, ...deposits]
          .filter((item) => item.reference.trim())
          .map((item) => ({
            itemType: item.itemType,
            reference: item.reference.trim(),
            amount: Number(item.amount) || 0,
          })),
        sourcePdfPath,
      });
      setMessage("error" in result ? result.error : "Conciliación guardada.");
      if (!("error" in result)) router.refresh();
    });
  };

  const renderList = (
    title: string,
    items: Item[],
    setItems: (items: Item[]) => void,
    itemType: Item["itemType"],
  ) => (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          size="sm"
          variant="outline"
          disabled={readOnly}
          onClick={() => setItems([...items, { itemType, reference: "", amount: "" }])}
        >
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              placeholder="Referencia"
              value={item.reference}
              disabled={readOnly}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, reference: event.target.value };
                setItems(next);
              }}
            />
            <Input
              inputMode="decimal"
              placeholder="Monto"
              className="w-32"
              value={item.amount}
              disabled={readOnly}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, amount: event.target.value };
                setItems(next);
              }}
            />
            <button
              type="button"
              aria-label="Eliminar"
              disabled={readOnly}
              className="text-muted-foreground hover:text-destructive p-1"
              onClick={() => setItems(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin pendientes.</p>
        ) : null}
      </div>
      <p className="text-muted-foreground mt-2 text-right text-sm">
        Total: {formatMoney(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Reconciliation Report (FIRST BANK)</h2>
            <p className="text-muted-foreground text-sm">
              Statement ending + uncleared checks + uncleared deposits −
              Register debe dar $0.00.
            </p>
          </div>
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
              {extracting ? "Leyendo PDF…" : "Subir PDF del Reconciliation Report"}
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Statement ending balance</span>
            <Input
              inputMode="decimal"
              value={statementEnding}
              disabled={readOnly}
              onChange={(event) => setStatementEnding(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Register balance</span>
            <Input
              inputMode="decimal"
              value={register}
              disabled={readOnly}
              onChange={(event) => setRegister(event.target.value)}
            />
          </label>
        </div>
        <p
          className={`mt-4 text-sm font-medium ${Math.abs(control) < 0.005 ? "text-emerald-700" : "text-red-700"}`}
        >
          Control: {formatMoney(control)}{" "}
          {Math.abs(control) < 0.005 ? "(cuadra)" : "-- NO CUADRA"}
        </p>
      </SurfaceCard>

      <SurfaceCard>
        <div className="grid gap-6 sm:grid-cols-2">
          {renderList("Uncleared Checks and Payments", checks, setChecks, "uncleared_check")}
          {renderList("Uncleared Deposits and Credits", deposits, setDeposits, "uncleared_deposit")}
        </div>
      </SurfaceCard>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending || readOnly}>
          Guardar conciliación
        </Button>
        {message ? <span className="text-muted-foreground text-sm">{message}</span> : null}
      </div>
    </div>
  );
}
