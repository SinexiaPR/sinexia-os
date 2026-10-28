import Link from "next/link";
import { Suspense } from "react";
import { Upload } from "lucide-react";

import { CompanyTabs } from "@/components/company/company-tabs";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SEMAPHORE_LABELS } from "@/lib/labels";
import { getAdminClientDashboard } from "@/services/admin-client-dashboard";
import type { Company } from "@/types";

/** Encabezado de la ficha: nombre, estado, acción primaria y pestañas. */
export async function CompanyHeader({
  company,
}: {
  company: Pick<Company, "id" | "name" | "slug">;
}) {
  const cards = await getAdminClientDashboard();
  const card = cards.find((entry) => entry.company.id === company.id);

  return (
    <header className="space-y-4">
      <Breadcrumbs
        items={[
          { label: "Clientes", href: "/dashboard/admin/companies" },
          { label: company.name },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {company.name}
          </h1>
          {card ? (
            <StatusBadge
              tone={card.semaphore === "green" ? "success" : "warning"}
            >
              {SEMAPHORE_LABELS[card.semaphore]}
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Sin tareas configuradas</StatusBadge>
          )}
        </div>
        <Button asChild className="h-10">
          <Link
            href={`/dashboard/admin/companies/${company.id}/reportes?publicar=1`}
          >
            <Upload className="size-4" />
            Subir reporte
          </Link>
        </Button>
      </div>
      <Suspense fallback={<div className="h-11" aria-hidden />}>
        <CompanyTabs company={{ id: company.id, slug: company.slug }} />
      </Suspense>
    </header>
  );
}
