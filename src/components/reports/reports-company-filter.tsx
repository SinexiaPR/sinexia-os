"use client";

import { useRouter } from "next/navigation";

import { Combobox } from "@/components/ui/combobox";
import type { Company } from "@/types";

/** Filtro de empresa para la lista de reportes (cambia `?company=`). */
export function ReportsCompanyFilter({
  companies,
  value,
}: {
  companies: Company[];
  value?: string;
}) {
  const router = useRouter();
  return (
    <div className="w-full sm:w-72">
      <Combobox
        aria-label="Filtrar por empresa"
        options={companies.map((company) => ({
          value: company.id,
          label: company.name,
        }))}
        value={value ?? ""}
        onValueChange={(next) =>
          router.push(
            next ? `/dashboard/reports?company=${next}` : "/dashboard/reports",
          )
        }
        allLabel="Todas las empresas"
        placeholder="Todas las empresas"
        searchPlaceholder="Buscar empresa…"
        emptyMessage="Ninguna empresa coincide."
      />
    </div>
  );
}
