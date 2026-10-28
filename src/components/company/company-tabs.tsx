"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { getActiveCompanyTab, getCompanyTabs } from "@/lib/companies/tabs";
import { cn } from "@/lib/utils";

/** Barra de pestañas de la ficha. Cada pestaña es una ruta (enlaces reales). */
export function CompanyTabs({
  company,
}: {
  company: { id: string; slug: string };
}) {
  const pathname = usePathname();
  const tabParam = useSearchParams().get("tab");
  const tabs = getCompanyTabs(company);
  const active = getActiveCompanyTab(company, pathname, tabParam);

  return (
    <nav
      aria-label="Secciones de la empresa"
      className="border-border -mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex min-w-max items-center gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring -mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  isActive
                    ? "border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
