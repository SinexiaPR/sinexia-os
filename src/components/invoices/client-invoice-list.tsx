"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CLIENT_INVOICE_STATUS_LABELS,
  CLIENT_INVOICE_STATUS_TONES,
  labelFor,
} from "@/lib/labels";
import { paginate } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/types/invoices";

function money(invoice: Invoice) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: invoice.currency,
  }).format(Number(invoice.total));
}

/** Facturas de la empresa del cliente: 10 por página, detalle al abrir una. */
export function ClientInvoiceList({
  invoices,
  selectedId,
}: {
  invoices: Invoice[];
  selectedId?: string;
}) {
  const [page, setPage] = useState(1);
  const view = paginate(invoices, page, 10);

  return (
    <SurfaceCard padding="sm" className="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4">Factura</TableHead>
            <TableHead className="hidden md:table-cell">Fecha</TableHead>
            <TableHead className="hidden md:table-cell">Vence</TableHead>
            <TableHead numeric>Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead numeric className="hidden px-4 md:table-cell">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.items.map((invoice) => (
            <TableRow
              key={invoice.id}
              className={cn(invoice.id === selectedId && "bg-primary/5")}
            >
              <TableCell className="px-4 font-medium whitespace-nowrap">
                <Link
                  href={`/dashboard/invoices?invoiceId=${invoice.id}#factura`}
                  className="focus-visible:ring-ring -mx-1 inline-flex min-h-10 items-center rounded-sm px-1 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none md:no-underline md:hover:no-underline"
                >
                  #{invoice.invoice_number}
                </Link>
                <span className="text-muted-foreground block text-xs font-normal whitespace-nowrap md:hidden">
                  Vence {invoice.due_date ?? "—"}
                </span>
              </TableCell>
              <TableCell className="hidden tabular-nums md:table-cell">
                {invoice.invoice_date ?? "—"}
              </TableCell>
              <TableCell className="hidden tabular-nums md:table-cell">
                {invoice.due_date ?? "—"}
              </TableCell>
              <TableCell numeric className="font-medium">
                {money(invoice)}
              </TableCell>
              <TableCell>
                <StatusBadge tone={CLIENT_INVOICE_STATUS_TONES[invoice.status]}>
                  {labelFor(CLIENT_INVOICE_STATUS_LABELS, invoice.status)}
                </StatusBadge>
              </TableCell>
              <TableCell className="hidden px-4 md:table-cell">
                <div className="flex items-center justify-end gap-1">
                  <Button asChild size="sm" variant="outline" className="h-10">
                    <Link
                      href={`/dashboard/invoices?invoiceId=${invoice.id}#factura`}
                    >
                      Ver factura
                    </Link>
                  </Button>
                  {invoice.pdf_storage_path ? (
                    <Button
                      asChild
                      size="icon"
                      variant="ghost"
                      className="size-10"
                    >
                      <a
                        href={`/api/invoices/${invoice.id}/download`}
                        aria-label={`Descargar PDF de la factura ${invoice.invoice_number}`}
                      >
                        <Download className="size-4" />
                      </a>
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PaginationBar view={view} onPageChange={setPage} />
    </SurfaceCard>
  );
}
