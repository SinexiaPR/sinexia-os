"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileDown,
  RefreshCw,
} from "lucide-react";

import { generateWeeklyBudget } from "@/actions/tresbe-budget";
import { AssumptionsTab } from "@/components/tresbe-budget/assumptions-tab";
import { CashControlCard } from "@/components/tresbe-budget/cash-control";
import { HorizonSummary } from "@/components/tresbe-budget/horizon-summary";
import { MovementsTab } from "@/components/tresbe-budget/movements-tab";
import {
  FinancingBlock,
  WeeklyGrid,
} from "@/components/tresbe-budget/weekly-grid";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { HorizonRow, WeekView } from "@/lib/tresbe-budget/calculations";
import {
  addDays,
  formatWeekRange,
  weekStartOf,
} from "@/lib/tresbe-budget/dates";
import type {
  BudgetAssumptions,
  BudgetCategory,
  BudgetCounterparty,
  BudgetMovement,
} from "@/services/tresbe-budget";
import { cn } from "@/lib/utils";

type Company = { id: string; name: string; slug: string };
type Tab = "semana" | "movimientos" | "resumen" | "supuestos";

const tabs: Array<{ key: Tab; label: string }> = [
  { key: "semana", label: "Seguimiento diario" },
  { key: "movimientos", label: "Movimientos reales" },
  { key: "resumen", label: "Resumen de semanas" },
  { key: "supuestos", label: "Supuestos" },
];

export function TresbeBudgetWorkspace({
  company,
  weekStart,
  weekNumber,
  week,
  categories,
  counterparties,
  movements,
  assumptions,
  horizon,
}: {
  company: Company;
  weekStart: string;
  weekNumber: number | null;
  week: WeekView;
  categories: BudgetCategory[];
  counterparties: BudgetCounterparty[];
  movements: BudgetMovement[];
  assumptions: BudgetAssumptions | null;
  horizon: { weeks: number; rows: HorizonRow[] };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("semana");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const goToWeek = (value: string) => {
    router.push(
      `/dashboard/admin/companies/${company.id}/budget?week=${weekStartOf(value)}`,
    );
  };

  const generate = (overwriteManual: boolean) => {
    startTransition(async () => {
      const result = await generateWeeklyBudget({
        companyId: company.id,
        weekStart,
        overwriteManual,
      });
      if ("error" in result) {
        setMessage(result.error ?? "No se pudo generar el presupuesto.");
        return;
      }
      setMessage(
        `Presupuesto generado: ${result.generated} celdas calculadas` +
          (result.keptManual
            ? ` · ${result.keptManual} celdas manuales respetadas`
            : ""),
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <header className="space-y-5">
        <Button asChild variant="ghost" className="-ml-3">
          <Link href={`/dashboard/admin/companies/${company.id}`}>
            <ArrowLeft className="size-4" />
            Volver a {company.name}
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {company.name} · Presupuesto / Forecast
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {weekNumber ? `Semana ${weekNumber}` : "Semana"} ·{" "}
              {formatWeekRange(weekStart)}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Semana anterior"
              onClick={() => goToWeek(addDays(weekStart, -7))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <input
              type="date"
              value={weekStart}
              onChange={(event) =>
                event.target.value && goToWeek(event.target.value)
              }
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Semana siguiente"
              onClick={() => goToWeek(addDays(weekStart, 7))}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button asChild variant="outline">
              <Link
                href={`/api/tresbe-budget/${company.id}/pdf?week=${weekStart}`}
                target="_blank"
              >
                <FileDown className="size-4" />
                PDF de la semana
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <nav className="border-b">
        <ul className="-mb-px flex flex-wrap gap-1">
          {tabs.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                  tab === item.key
                    ? "border-foreground text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}

      {tab === "semana" ? (
        <div className="space-y-6">
          <SurfaceCard padding="sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-base font-semibold">
                  Presupuestado vs Real
                </h2>
                <p className="text-muted-foreground text-sm">
                  {week.manualCells > 0
                    ? `${week.manualCells} celdas editadas a mano en esta semana.`
                    : "Todas las celdas del presupuesto vienen de los supuestos."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={pending || !assumptions}
                  onClick={() => generate(false)}
                >
                  <RefreshCw className="size-4" />
                  Generar presupuesto de la semana
                </Button>
                {week.manualCells > 0 ? (
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Esto reemplaza también las celdas editadas a mano. ¿Continuar?",
                        )
                      ) {
                        generate(true);
                      }
                    }}
                  >
                    Regenerar pisando las manuales
                  </Button>
                ) : null}
              </div>
            </div>
            {!assumptions ? (
              <p className="mt-3 px-1 text-sm text-amber-700">
                Configura los supuestos del forecast para poder generar el
                presupuesto.
              </p>
            ) : null}
            <div className="mt-4">
              <WeeklyGrid
                companyId={company.id}
                week={week}
                onMessage={setMessage}
              />
              <FinancingBlock week={week} />
            </div>
          </SurfaceCard>
          <CashControlCard
            companyId={company.id}
            weekStart={weekStart}
            week={week}
          />
        </div>
      ) : null}

      {tab === "movimientos" ? (
        <MovementsTab
          companyId={company.id}
          weekStart={weekStart}
          categories={categories}
          counterparties={counterparties}
          movements={movements}
        />
      ) : null}

      {tab === "resumen" ? (
        <HorizonSummary
          companyId={company.id}
          weeks={horizon.weeks}
          rows={horizon.rows}
        />
      ) : null}

      {tab === "supuestos" ? (
        assumptions ? (
          <AssumptionsTab
            companyId={company.id}
            assumptions={assumptions}
            categories={categories}
          />
        ) : (
          <SurfaceCard>
            <p className="text-sm">
              No hay supuestos configurados para esta empresa.
            </p>
          </SurfaceCard>
        )
      ) : null}
    </div>
  );
}
