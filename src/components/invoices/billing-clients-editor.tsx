"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveBillingBatchClient, setBillingBatchClientActive } from "@/actions/billing-batch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { BillingBatchClient } from "@/types/invoices";

const money = (value: number | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

type Draft = {
  companyId: string;
  amountType: "fixed" | "system";
  fixedAmount: string;
  lineDescription: string;
  active: boolean;
  displayOrder: string;
};

const emptyDraft: Draft = {
  companyId: "",
  amountType: "fixed",
  fixedAmount: "",
  lineDescription: "",
  active: true,
  displayOrder: "",
};

export function BillingClientsEditor({
  clients,
  companies,
}: {
  clients: BillingBatchClient[];
  companies: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showNew, setShowNew] = useState(false);

  const usedCompanyIds = new Set(clients.map((client) => client.company_id));
  const availableCompanies = companies.filter((company) => !usedCompanyIds.has(company.id));

  const submitNew = () => {
    if (!draft.companyId || !draft.lineDescription.trim()) {
      setMessage("Elegí un cliente y escribí la descripción de la línea.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await saveBillingBatchClient({
        companyId: draft.companyId,
        amountType: draft.amountType,
        fixedAmount: draft.amountType === "fixed" ? Number(draft.fixedAmount) : null,
        lineDescription: draft.lineDescription.trim(),
        active: true,
        displayOrder: draft.displayOrder ? Number(draft.displayOrder) : null,
      });
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      setDraft(emptyDraft);
      setShowNew(false);
      router.refresh();
    });
  };

  const toggleActive = (client: BillingBatchClient) => {
    const warning = client.active
      ? `¿Desactivar a ${client.companies?.name}? No entrará en el próximo lote semanal, pero nada se borra.`
      : `¿Reactivar a ${client.companies?.name}? Volverá a entrar en el próximo lote semanal.`;
    if (!window.confirm(warning)) return;
    startTransition(async () => {
      const result = await setBillingBatchClientActive(client.id, !client.active);
      if ("error" in result) setMessage(result.error);
      else router.refresh();
    });
  };

  const updateAmount = (client: BillingBatchClient, value: string) => {
    startTransition(async () => {
      const result = await saveBillingBatchClient({
        id: client.id,
        companyId: client.company_id,
        amountType: client.amount_type,
        fixedAmount: client.amount_type === "fixed" ? Number(value) : null,
        lineDescription: client.line_description,
        active: client.active,
        displayOrder: client.display_order,
      });
      if ("error" in result) setMessage(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {message ? <p className="text-destructive text-sm">{message}</p> : null}
      <SurfaceCard padding="sm">
        <table className="w-full text-left text-[13px]">
          <thead className="text-muted-foreground border-b text-xs uppercase">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th>Tipo de monto</th>
              <th>Monto</th>
              <th>Descripción de la línea</th>
              <th>Activo</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{client.companies?.name}</td>
                <td>{client.amount_type === "fixed" ? "Fijo" : "Del sistema"}</td>
                <td>
                  {client.amount_type === "fixed" ? (
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 w-28"
                      defaultValue={client.fixed_amount ?? ""}
                      disabled={pending}
                      onBlur={(event) => {
                        if (Number(event.target.value) !== client.fixed_amount)
                          updateAmount(client, event.target.value);
                      }}
                    />
                  ) : (
                    <span className="text-muted-foreground">{money(client.fixed_amount)}</span>
                  )}
                </td>
                <td>{client.line_description}</td>
                <td>{client.active ? "Sí" : "No"}</td>
                <td className="text-right">
                  <Button
                    size="sm"
                    variant={client.active ? "outline" : "default"}
                    disabled={pending}
                    onClick={() => toggleActive(client)}
                  >
                    {client.active ? "Desactivar" : "Reactivar"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!clients.length ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Todavía no hay clientes facturables configurados.
          </p>
        ) : null}
      </SurfaceCard>

      {showNew ? (
        <SurfaceCard padding="sm">
          <h3 className="px-1 text-base font-semibold">Agregar cliente facturable</h3>
          <div className="mt-3 grid gap-3 px-1 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">Empresa</span>
              <select
                className="bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={draft.companyId}
                onChange={(event) => setDraft((d) => ({ ...d, companyId: event.target.value }))}
              >
                <option value="">Elegir...</option>
                {availableCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground text-xs">Tipo de monto</span>
              <select
                className="bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={draft.amountType}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, amountType: event.target.value as "fixed" | "system" }))
                }
              >
                <option value="fixed">Fijo</option>
                <option value="system">Del sistema</option>
              </select>
            </label>
            {draft.amountType === "fixed" ? (
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground text-xs">Monto fijo (USD)</span>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.fixedAmount}
                  onChange={(event) => setDraft((d) => ({ ...d, fixedAmount: event.target.value }))}
                />
              </label>
            ) : null}
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-muted-foreground text-xs">Descripción de la línea</span>
              <Input
                value={draft.lineDescription}
                onChange={(event) => setDraft((d) => ({ ...d, lineDescription: event.target.value }))}
                placeholder="Paquete Sinexia Pro"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2 px-1">
            <Button onClick={submitNew} disabled={pending}>
              Guardar
            </Button>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancelar
            </Button>
          </div>
        </SurfaceCard>
      ) : (
        <Button variant="outline" onClick={() => setShowNew(true)} disabled={!availableCompanies.length}>
          Agregar cliente facturable
        </Button>
      )}
    </div>
  );
}
