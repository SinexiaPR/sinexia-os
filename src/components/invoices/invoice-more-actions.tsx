"use client";

import Link from "next/link";
import {
  Building2,
  CalendarRange,
  MoreHorizontal,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Menú "Más acciones" de Facturación (acciones secundarias). */
export function InvoiceMoreActions() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-10">
          <MoreHorizontal className="size-4" />
          Más acciones
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem asChild>
          <Link href="/dashboard/admin/invoices/batch">
            <CalendarRange />
            Generar facturas de la semana
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/admin/invoices/billing-clients">
            <Building2 />
            Clientes facturables
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/admin/settings/billing">
            <Settings />
            Configuración
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
