"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { Plus, Trash2, Upload } from "lucide-react";

import { extractAgingPdf, saveAgingCustomers, saveAgingVendors } from "@/actions/cutmeat-daily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatMoney } from "@/lib/cutmeat-daily/format";
import type {
  AgingLine,
  CustomerAgingResult,
  VendorAgingResult,
} from "@/lib/cutmeat-daily/calculations";

type Row = { name: string; balance: string };

function AgingBlock({
  title,
  companyId,
  reportId,
  readOnly,
  items,
  save,
  extra,
}: {
  title: string;
  companyId: string;
  reportId: string | null;
  readOnly: boolean;
  items: AgingLine[];
  save: typeof saveAgingVendors;
  extra?: ReactNode;
}) {
  const [rawTotal, setRawTotal] = useState(
    String(items.reduce((sum, item) => sum + item.balance, 0)),
  );
  const [rows, setRows] = useState<Row[]>(
    items.map((item) => ({ name: item.name, balance: String(item.balance) })),
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
      const result = await extractAgingPdf(formData);
      setExtracting(false);
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      if (result.rawTotal != null) setRawTotal(String(result.rawTotal));
      setRows(result.items.map((item) => ({ name: item.name, balance: String(item.balance) })));
      setSourcePdfPath(result.sourcePdfPath);
      setMessage("PDF leído -- revisá el detalle antes de guardar.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  const submit = () => {
    if (!reportId) {
      setMessage("Primero creá el informe de este día.");
      return;
    }
    startTransition(async () => {
      const result = await save({
        companyId,
        reportId,
        rawTotal: Number(rawTotal) || 0,
        items: rows
          .filter((row) => row.name.trim())
          .map((row) => ({ name: row.name.trim(), balance: Number(row.balance) || 0 })),
        sourcePdfPath,
      });
      setMessage("error" in result ? result.error : "Aging guardado.");
      if (!("error" in result)) router.refresh();
    });
  };

  return (
    <SurfaceCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
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
            {extracting ? "Leyendo PDF…" : "Subir PDF"}
          </Button>
        </div>
      </div>
      <label className="mt-3 block max-w-xs space-y-1 text-sm">
        <span className="text-muted-foreground text-xs">
          TOTAL general (del PDF de QuickBooks)
        </span>
        <Input
          inputMode="decimal"
          value={rawTotal}
          disabled={readOnly}
          onChange={(event) => setRawTotal(event.target.value)}
        />
      </label>

      {extra}

      <div className="mt-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Detalle</h3>
        <Button
          size="sm"
          variant="outline"
          disabled={readOnly}
          onClick={() => setRows((current) => [...current, { name: "", balance: "" }])}
        >
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>
      <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              placeholder="Nombre"
              value={row.name}
              disabled={readOnly}
              onChange={(event) => {
                const next = [...rows];
                next[index] = { ...row, name: event.target.value };
                setRows(next);
              }}
            />
            <Input
              inputMode="decimal"
              placeholder="Balance"
              className="w-32"
              value={row.balance}
              disabled={readOnly}
              onChange={(event) => {
                const next = [...rows];
                next[index] = { ...row, balance: event.target.value };
                setRows(next);
              }}
            />
            <button
              type="button"
              aria-label="Eliminar"
              disabled={readOnly}
              className="text-muted-foreground hover:text-destructive p-1"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin detalle cargado.</p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit} disabled={pending || readOnly}>
          Guardar {title.toLowerCase()}
        </Button>
        {message ? <span className="text-muted-foreground text-sm">{message}</span> : null}
      </div>
    </SurfaceCard>
  );
}

export function AgingTab({
  companyId,
  reportId,
  readOnly,
  vendorItems,
  vendorAging,
  customerItems,
  customerAging,
}: {
  companyId: string;
  reportId: string | null;
  readOnly: boolean;
  vendorItems: AgingLine[];
  vendorAging: VendorAgingResult | null;
  customerItems: AgingLine[];
  customerAging: CustomerAgingResult | null;
}) {
  return (
    <div className="space-y-6">
      <AgingBlock
        title="Aging Vendors (Vendor Balance Detail Report)"
        companyId={companyId}
        reportId={reportId}
        readOnly={readOnly}
        items={vendorItems}
        save={saveAgingVendors}
        extra={
          vendorAging ? (
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-muted-foreground">
                Consolidado = raw total − excluidos ({formatMoney(vendorAging.excludedSubtotal)})
                − Prime Meats ({formatMoney(vendorAging.primeMeatsBalance)})
              </p>
              <p className="font-semibold">
                Consolidado Wagyu + Prime Meats: {formatMoney(vendorAging.consolidated)}
              </p>
              {vendorAging.unconfiguredVendors.length ? (
                <p className="text-amber-800">
                  Proveedores sin configurar: {" "}
                  {vendorAging.unconfiguredVendors.map((v) => v.name).join(", ")} -- agregalos en
                  Configuración.
                </p>
              ) : null}
            </div>
          ) : null
        }
      />
      <AgingBlock
        title="Aging Customers (Customer Balance Detail Report)"
        companyId={companyId}
        reportId={reportId}
        readOnly={readOnly}
        items={customerItems}
        save={saveAgingCustomers}
        extra={
          customerAging ? (
            <p className="mt-3 text-sm font-semibold">
              Consolidado Wagyu + Prime Meats: {formatMoney(customerAging.consolidated)}
            </p>
          ) : null
        }
      />
    </div>
  );
}
