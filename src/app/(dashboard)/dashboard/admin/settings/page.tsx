import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Receipt } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AdminIntegrityCheck } from "@/components/reports/admin-integrity-check";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Configuración",
};

export default async function AdminSettingsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Ajustes de la firma y herramientas de diagnóstico."
      />

      <SurfaceCard padding="sm" className="p-0">
        <Link
          href="/dashboard/admin/settings/billing"
          className="hover:bg-muted/50 focus-visible:ring-ring flex min-h-16 items-center gap-4 rounded-lg px-5 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <span
            aria-hidden
            className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md"
          >
            <Receipt className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              Configuración de facturación
            </span>
            <span className="text-muted-foreground block text-sm">
              Emisor, información de pago y perfiles de clientes.
            </span>
          </span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>
      </SurfaceCard>

      <SurfaceCard padding="sm" className="p-0">
        <Accordion type="single" collapsible>
          <AccordionItem value="herramientas">
            <AccordionTrigger>
              <span className="flex-1">Herramientas técnicas</span>
            </AccordionTrigger>
            <AccordionContent>
              <AdminIntegrityCheck />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SurfaceCard>
    </div>
  );
}
