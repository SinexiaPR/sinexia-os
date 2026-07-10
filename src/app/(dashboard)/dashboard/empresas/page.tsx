import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAuth } from "@/lib/auth/session";
import { getCompaniesWithStats } from "@/services/documents";

export const metadata: Metadata = {
  title: "Empresas",
};

export default async function EmpresasPage() {
  const profile = await requireAuth();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const companies = await getCompaniesWithStats();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Administración"
        title="Empresas"
        description="Empresas clientes activas y estado de sus documentos."
      />

      <SurfaceCard padding="md">
        {companies.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No hay empresas registradas.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {companies.map((company) => (
              <div
                key={company.id}
                className="flex flex-col gap-3 py-5 first:pt-2 last:pb-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{company.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {company.total_documents} documento
                    {company.total_documents === 1 ? "" : "s"} en total
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {company.pending_count > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                      <span className="size-1.5 rounded-full bg-red-500" />
                      {company.pending_count} pendiente
                      {company.pending_count === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">
                      Sin pendientes
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
