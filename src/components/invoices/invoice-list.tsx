"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { deleteInvoiceDraft } from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { Invoice, InvoiceStatus } from "@/types/invoices";

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Borrador",
  issued: "Emitida",
  sent: "Enviada",
  viewed: "Vista",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Cancelada",
};

export function InvoiceList({ invoices }: { invoices: Invoice[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [payment, setPayment] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const companies = useMemo(
    () =>
      Array.from(
        new Map(
          invoices.map((invoice) => [
            invoice.company_id,
            invoice.companies?.name ??
              invoice.billing_name_snapshot ??
              "Cliente",
          ]),
        ),
      ),
    [invoices],
  );
  const visible = invoices.filter((invoice) => {
    if (company && invoice.company_id !== company) return false;
    if (status && invoice.status !== status) return false;
    if (email === "sent" && invoice.email_status !== "sent") return false;
    if (email === "not_sent" && invoice.email_status === "sent") return false;
    if (payment === "paid" && invoice.status !== "paid") return false;
    if (payment === "unpaid" && invoice.status === "paid") return false;
    if (dateFrom && (invoice.invoice_date ?? "") < dateFrom) return false;
    if (dateTo && (invoice.invoice_date ?? "9999-12-31") > dateTo) return false;
    if (
      search &&
      !String(invoice.invoice_number ?? "borrador").includes(search) &&
      !invoice.billing_name_snapshot
        ?.toLowerCase()
        .includes(search.toLowerCase())
    )
      return false;
    return true;
  });
  const money = (invoice: Invoice) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: invoice.currency,
    }).format(Number(invoice.total));

  return (
    <SurfaceCard padding="sm">
      <div className="grid gap-3 border-b pb-5 md:grid-cols-4 xl:grid-cols-7">
        <Input
          placeholder="Número o cliente"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="bg-background h-9 rounded-md border px-3 text-sm"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        >
          <option value="">Todos los clientes</option>
          {companies.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="bg-background h-9 rounded-md border px-3 text-sm"
          value={payment}
          onChange={(event) => setPayment(event.target.value)}
        >
          <option value="">Pagadas y pendientes</option>
          <option value="paid">Pagadas</option>
          <option value="unpaid">Pendientes</option>
        </select>
        <Input
          type="date"
          aria-label="Fecha desde"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <Input
          type="date"
          aria-label="Fecha hasta"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
        <select
          className="bg-background h-9 rounded-md border px-3 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Todos los estados</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="bg-background h-9 rounded-md border px-3 text-sm"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        >
          <option value="">Todo correo</option>
          <option value="sent">Correo enviado</option>
          <option value="not_sent">Correo no enviado</option>
        </select>
      </div>
      {message ? (
        <p className="text-destructive border-b px-3 py-3 text-sm">{message}</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="text-muted-foreground border-b text-xs uppercase">
            <tr>
              <th className="px-3 py-3">Factura</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Vence</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Correo</th>
              <th>Enviada</th>
              <th>Pagada</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((invoice) => (
              <tr key={invoice.id} className="border-b last:border-0">
                <td className="px-3 py-4 font-medium">
                  {invoice.invoice_number
                    ? `#${invoice.invoice_number}`
                    : "Borrador"}
                  {invoice.is_legacy_import ? (
                    <span className="text-muted-foreground ml-2 text-xs">
                      Legacy
                    </span>
                  ) : null}
                </td>
                <td>
                  {invoice.billing_name_snapshot ?? invoice.companies?.name}
                </td>
                <td>{invoice.invoice_date ?? "Sin fecha"}</td>
                <td>{invoice.due_date ?? "—"}</td>
                <td className="font-medium">{money(invoice)}</td>
                <td>{statusLabels[invoice.status]}</td>
                <td>
                  {invoice.email_status === "sent"
                    ? "Enviado"
                    : (invoice.email_status ?? "—")}
                </td>
                <td>{invoice.sent_at?.slice(0, 10) ?? "—"}</td>
                <td>{invoice.paid_at?.slice(0, 10) ?? "—"}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/admin/invoices/${invoice.id}`}>
                        Ver
                      </Link>
                    </Button>
                    {invoice.status === "draft" ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        aria-label="Eliminar factura en borrador"
                        onClick={() => {
                          if (
                            !window.confirm(
                              "¿Eliminar esta factura de prueba? Esta acción no consume número oficial.",
                            )
                          )
                            return;
                          startTransition(async () => {
                            setMessage(null);
                            const result = await deleteInvoiceDraft(invoice.id);
                            if (result.error) setMessage(result.error);
                            else router.refresh();
                          });
                        }}
                      >
                        <Trash2 className="size-4" /> Eliminar
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            No hay facturas para estos filtros.
          </p>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
