"use client";

import {
  ChevronDown,
  FileText,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";

import { deleteInvoice } from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  EMPTY_INVOICE_FILTERS,
  INVOICE_STATUS_FILTERS,
  countAdvancedFilters,
  filterInvoices,
  paginate,
  type InvoiceFilters,
  type InvoiceStatusFilter,
} from "@/lib/invoices/list";
import {
  DELIVERY_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  labelFor,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/types/invoices";

function money(invoice: Invoice) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: invoice.currency,
  }).format(Number(invoice.total));
}

function shortDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "—";
}

function clientName(invoice: Invoice) {
  return invoice.billing_name_snapshot ?? invoice.companies?.name ?? "Cliente";
}

function invoiceLabel(invoice: Invoice) {
  return invoice.invoice_number ? `#${invoice.invoice_number}` : "Borrador";
}

const selectClassName =
  "bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function InvoiceList({
  invoices,
  initialStatus = "all",
  emptyMessage,
}: {
  invoices: Invoice[];
  initialStatus?: InvoiceStatusFilter;
  /** Mensaje cuando no hay ninguna factura (sin filtros aplicados). */
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<InvoiceFilters>({
    ...EMPTY_INVOICE_FILTERS,
    status: initialStatus,
  });
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const historicalCount = useMemo(
    () => invoices.filter((invoice) => invoice.is_legacy_import).length,
    [invoices],
  );
  const currentCount = invoices.length - historicalCount;

  const companies = useMemo(
    () =>
      Array.from(
        new Map(
          invoices.map((invoice) => [invoice.company_id, clientName(invoice)]),
        ),
      )
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [invoices],
  );

  const visible = useMemo(
    () => filterInvoices(invoices, filters),
    [invoices, filters],
  );
  const view = paginate(visible, page);
  const advancedCount = countAdvancedFilters(filters);

  function update(patch: Partial<InvoiceFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function remove(invoice: Invoice) {
    const warning =
      invoice.status === "cancelled"
        ? `¿Eliminar definitivamente la factura cancelada #${invoice.invoice_number}? Su número oficial no se reutilizará.`
        : "¿Eliminar esta factura de prueba? Esta acción no consume número oficial.";
    if (!window.confirm(warning)) return;
    startTransition(async () => {
      setMessage(null);
      const result = await deleteInvoice(invoice.id);
      if (result.error) setMessage(result.error);
      else router.refresh();
    });
  }

  return (
    <SurfaceCard padding="sm" className="p-0">
      <div className="border-border/70 space-y-3 border-b p-4">
        <div role="group" aria-label="Tipo de factura" className="flex gap-1">
          {[
            { historical: false, label: "Facturas", count: currentCount },
            { historical: true, label: "Históricas", count: historicalCount },
          ].map((tab) => (
            <button
              key={tab.label}
              type="button"
              aria-pressed={filters.historical === tab.historical}
              onClick={() => update({ historical: tab.historical })}
              className={cn(
                "focus-visible:ring-ring min-h-10 rounded-md px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none",
                filters.historical === tab.historical
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {tab.label}
              <span className="ml-1.5 tabular-nums opacity-80">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search
              aria-hidden
              className="text-muted-foreground absolute top-3 left-3 size-4"
            />
            <Input
              type="search"
              placeholder="Número o cliente"
              aria-label="Buscar por número o cliente"
              value={filters.search}
              onChange={(event) => update({ search: event.target.value })}
              className="h-10 pl-9"
            />
          </div>

          <div
            role="group"
            aria-label="Estado"
            className="flex flex-wrap gap-1.5"
          >
            {INVOICE_STATUS_FILTERS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                aria-pressed={filters.status === chip.value}
                onClick={() => update({ status: chip.value })}
                className={cn(
                  "focus-visible:ring-ring min-h-10 rounded-full border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none",
                  filters.status === chip.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10">
                <SlidersHorizontal className="size-4" />
                Más filtros
                {advancedCount > 0 ? (
                  <span className="bg-primary text-primary-foreground ml-1 flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums">
                    {advancedCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cliente</label>
                <Combobox
                  aria-label="Cliente"
                  options={companies}
                  value={filters.companyId}
                  onValueChange={(companyId) => update({ companyId })}
                  allLabel="Todos los clientes"
                  placeholder="Todos los clientes"
                  searchPlaceholder="Buscar cliente…"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="filtro-correo" className="text-sm font-medium">
                  Correo
                </label>
                <select
                  id="filtro-correo"
                  className={selectClassName}
                  value={filters.email}
                  onChange={(event) =>
                    update({
                      email: event.target.value as InvoiceFilters["email"],
                    })
                  }
                >
                  <option value="">Todo</option>
                  <option value="sent">Enviado</option>
                  <option value="not_sent">No enviado</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label htmlFor="filtro-desde" className="text-sm font-medium">
                    Desde
                  </label>
                  <Input
                    id="filtro-desde"
                    type="date"
                    className="h-10"
                    value={filters.dateFrom}
                    onChange={(event) =>
                      update({ dateFrom: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="filtro-hasta" className="text-sm font-medium">
                    Hasta
                  </label>
                  <Input
                    id="filtro-hasta"
                    type="date"
                    className="h-10"
                    value={filters.dateTo}
                    onChange={(event) => update({ dateTo: event.target.value })}
                  />
                </div>
              </div>
              {advancedCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    update({
                      companyId: "",
                      email: "",
                      dateFrom: "",
                      dateTo: "",
                    })
                  }
                >
                  Limpiar filtros
                </Button>
              ) : null}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {message ? (
        <p role="alert" className="text-destructive border-b px-4 py-3 text-sm">
          {message}
        </p>
      ) : null}

      {view.total === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            emptyMessage && invoices.length === 0
              ? emptyMessage
              : "No hay facturas para estos filtros"
          }
          description={
            filters.historical
              ? "No hay facturas históricas con estos criterios."
              : "Prueba con otro estado o limpia los filtros."
          }
          action={
            <Button
              variant="outline"
              onClick={() =>
                setFilters({
                  ...EMPTY_INVOICE_FILTERS,
                  historical: filters.historical,
                })
              }
            >
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-card text-muted-foreground sticky top-0 z-10 text-xs">
              <tr className="border-b">
                <th scope="col" className="w-10 px-2 py-2.5">
                  <span className="sr-only">Detalle</span>
                </th>
                <th scope="col" className="px-2 py-2.5 font-medium">
                  Factura
                </th>
                <th
                  scope="col"
                  className="hidden px-2 py-2.5 font-medium md:table-cell"
                >
                  Cliente
                </th>
                <th
                  scope="col"
                  className="hidden px-2 py-2.5 font-medium md:table-cell"
                >
                  Vence
                </th>
                <th scope="col" className="px-2 py-2.5 text-right font-medium">
                  Total
                </th>
                <th scope="col" className="px-2 py-2.5 font-medium">
                  Estado
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {view.items.map((invoice) => {
                const isOpen = expanded.has(invoice.id);
                const detailId = `detalle-${invoice.id}`;
                const canDelete =
                  ["draft", "cancelled"].includes(invoice.status) &&
                  !invoice.is_legacy_import;
                return (
                  <Fragment key={invoice.id}>
                    <tr className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10"
                          aria-expanded={isOpen}
                          aria-controls={detailId}
                          aria-label={`${isOpen ? "Ocultar" : "Ver"} detalle de ${invoiceLabel(invoice)}`}
                          onClick={() => toggle(invoice.id)}
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform",
                              isOpen && "rotate-180",
                            )}
                          />
                        </Button>
                      </td>
                      <td className="px-2 py-2 font-medium">
                        <span>{invoiceLabel(invoice)}</span>
                        <span className="text-muted-foreground block text-xs font-normal md:hidden">
                          {clientName(invoice)}
                        </span>
                      </td>
                      <td className="hidden px-2 py-2 md:table-cell">
                        {clientName(invoice)}
                      </td>
                      <td className="hidden px-2 py-2 tabular-nums md:table-cell">
                        {invoice.due_date ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-medium tabular-nums">
                        {money(invoice)}
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge
                          tone={INVOICE_STATUS_TONES[invoice.status]}
                        >
                          {labelFor(INVOICE_STATUS_LABELS, invoice.status)}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-10"
                          >
                            <Link
                              href={`/dashboard/admin/invoices/${invoice.id}`}
                            >
                              Ver
                            </Link>
                          </Button>
                          {canDelete ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-10"
                                  disabled={pending}
                                  aria-label={`Más acciones de ${invoiceLabel(invoice)}`}
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => remove(invoice)}
                                >
                                  <Trash2 />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr id={detailId} className="bg-muted/30 border-b">
                        <td />
                        <td colSpan={6} className="px-2 py-3">
                          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
                            <div className="md:hidden">
                              <dt className="text-muted-foreground text-xs">
                                Vence
                              </dt>
                              <dd className="tabular-nums">
                                {invoice.due_date ?? "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground text-xs">
                                Emisión
                              </dt>
                              <dd className="tabular-nums">
                                {invoice.invoice_date ?? "Sin fecha"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground text-xs">
                                Correo
                              </dt>
                              <dd>
                                {labelFor(
                                  DELIVERY_STATUS_LABELS,
                                  invoice.email_status,
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground text-xs">
                                Enviada
                              </dt>
                              <dd className="tabular-nums">
                                {shortDate(invoice.sent_at)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground text-xs">
                                Pagada
                              </dt>
                              <dd className="tabular-nums">
                                {shortDate(invoice.paid_at)}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground text-xs">
                                Vista
                              </dt>
                              <dd className="tabular-nums">
                                {invoice.viewed_at
                                  ? invoice.viewed_at
                                      .slice(0, 16)
                                      .replace("T", " ")
                                  : "No vista"}
                              </dd>
                            </div>
                            {invoice.pdf_storage_path ? (
                              <div>
                                <dt className="text-muted-foreground text-xs">
                                  PDF
                                </dt>
                                <dd>
                                  <a
                                    href={`/api/invoices/${invoice.id}/download`}
                                    className="text-primary underline-offset-4 hover:underline"
                                  >
                                    Descargar PDF
                                  </a>
                                </dd>
                              </div>
                            ) : null}
                          </dl>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PaginationBar view={view} onPageChange={setPage} />
    </SurfaceCard>
  );
}
