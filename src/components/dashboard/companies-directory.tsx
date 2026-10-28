"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import { SEMAPHORE_LABELS } from "@/lib/labels";
import type { ClientDashboardCard } from "@/types/admin-client-dashboard";

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function CompaniesDirectory({
  cards,
}: {
  cards: ClientDashboardCard[];
}) {
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const term = normalize(search.trim());
    return cards
      .filter(({ company }) => !term || normalize(company.name).includes(term))
      .sort((a, b) => {
        if (a.semaphore !== b.semaphore)
          return a.semaphore === "amber" ? -1 : 1;
        return a.company.name.localeCompare(b.company.name, "es");
      });
  }, [cards, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search
          aria-hidden
          className="text-muted-foreground absolute top-3 left-3 size-4"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar cliente…"
          aria-label="Buscar cliente"
          className="h-10 pl-9"
        />
      </div>

      <SurfaceCard padding="sm" className="p-0">
        {visible.length ? (
          <ul className="divide-border/70 divide-y">
            {visible.map(({ company, semaphore, items }) => {
              const pending = items.filter(
                (item) => item.state !== "done",
              ).length;
              return (
                <li key={company.id}>
                  <Link
                    href={`/dashboard/admin/companies/${company.id}`}
                    className="hover:bg-muted/50 focus-visible:ring-ring flex min-h-14 items-center gap-4 px-5 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {company.name}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {pending > 0
                          ? `${pending} ${pending === 1 ? "tarea pendiente" : "tareas pendientes"}`
                          : "Sin pendientes"}
                      </span>
                    </span>
                    <StatusBadge
                      tone={semaphore === "green" ? "success" : "warning"}
                    >
                      {SEMAPHORE_LABELS[semaphore]}
                    </StatusBadge>
                    <ChevronRight
                      aria-hidden
                      className="text-muted-foreground size-4"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground px-5 py-10 text-center text-sm">
            {cards.length
              ? "Ningún cliente coincide con tu búsqueda."
              : "No hay clientes activos configurados todavía."}
          </p>
        )}
      </SurfaceCard>
    </div>
  );
}
