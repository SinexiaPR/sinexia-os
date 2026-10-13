"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";

import { saveAgingCustomers, saveAgingVendors } from "@/actions/cutmeat-daily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatMoney } from "@/lib/cutmeat-daily/format";
import type {
  AgingDetailLine,
  CustomerAgingResult,
  VendorAgingResult,
} from "@/lib/cutmeat-daily/calculations";

type Row = {
  name: string;
  balance: string;
  txnDate: string;
  txnType: string;
  num: string;
  dueDate: string;
  amount: string;
  openBalance: string;
};

function emptyRow(): Row {
  return { name: "", balance: "", txnDate: "", txnType: "", num: "", dueDate: "", amount: "", openBalance: "" };
}

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
  items: AgingDetailLine[];
  save: typeof saveAgingVendors;
  extra?: ReactNode;
}) {
  const [rawTotal, setRawTotal] = useState(
    String(items.reduce((sum, item) => sum + item.balance, 0)),
  );
  const [rows, setRows] = useState<Row[]>(
    items.map((item) => ({
      name: item.name,
      balance: String(item.balance),
      txnDate: item.txnDate ?? "",
      txnType: item.txnType ?? "",
      num: item.num ?? "",
      dueDate: item.dueDate ?? "",
      amount: item.amount == null ? "" : String(item.amount),
      openBalance: item.openBalance == null ? "" : String(item.openBalance),
    })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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
          .map((row) => ({
            name: row.name.trim(),
            balance: Number(row.balance) || 0,
            txnDate: row.txnDate || null,
            txnType: row.txnType.trim() || null,
            num: row.num.trim() || null,
            dueDate: row.dueDate || null,
            amount: row.amount ? Number(row.amount) : null,
            openBalance: row.openBalance ? Number(row.openBalance) : null,
          })),
        sourcePdfPath: null,
      });
      setMessage("error" in result ? result.error : "Aging guardado.");
      if (!("error" in result)) router.refresh();
    });
  };

  return (
    <SurfaceCard>
      <h2 className="text-base font-semibold">{title}</h2>
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
        <div>
          <h3 className="text-sm font-semibold">Detalle</h3>
          <p className="text-muted-foreground text-xs">
            Nombre + balance alcanza para el total. Para reproducir el
            detalle por factura del PDF original, completá además fecha/
            tipo/número/vencimiento/monto/saldo abierto -- un nombre puede
            repetirse en varias filas (una por factura).
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={readOnly}
          onClick={() => setRows((current) => [...current, emptyRow()])}
        >
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>
      <div className="mt-2 max-h-[32rem] space-y-2 overflow-y-auto">
        {rows.map((row, index) => (
          <div key={index} className="space-y-1.5 rounded-lg border p-2">
            <div className="flex items-center gap-2">
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
            <div className="grid gap-1.5 sm:grid-cols-6">
              <Input
                type="date"
                placeholder="Fecha"
                value={row.txnDate}
                disabled={readOnly}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, txnDate: event.target.value };
                  setRows(next);
                }}
              />
              <Input
                placeholder="Tipo"
                value={row.txnType}
                disabled={readOnly}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, txnType: event.target.value };
                  setRows(next);
                }}
              />
              <Input
                placeholder="Número"
                value={row.num}
                disabled={readOnly}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, num: event.target.value };
                  setRows(next);
                }}
              />
              <Input
                type="date"
                placeholder="Vencimiento"
                value={row.dueDate}
                disabled={readOnly}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, dueDate: event.target.value };
                  setRows(next);
                }}
              />
              <Input
                inputMode="decimal"
                placeholder="Monto"
                value={row.amount}
                disabled={readOnly}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, amount: event.target.value };
                  setRows(next);
                }}
              />
              <Input
                inputMode="decimal"
                placeholder="Saldo abierto"
                value={row.openBalance}
                disabled={readOnly}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, openBalance: event.target.value };
                  setRows(next);
                }}
              />
            </div>
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
  vendorItems: AgingDetailLine[];
  vendorAging: VendorAgingResult | null;
  customerItems: AgingDetailLine[];
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
