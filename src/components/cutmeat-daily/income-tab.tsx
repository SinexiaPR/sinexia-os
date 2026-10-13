"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveIncomeProjection } from "@/actions/cutmeat-daily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { formatDayLabel, weekDatesSundayToSaturday, type IsoDate } from "@/lib/cutmeat-daily/dates";

/**
 * Proyección de ingresos THIS WEEK (domingo a sábado). El lunes se
 * excluye del cálculo del Financial Report (ya reflejado en el Register
 * / a punto de reconciliarse), pero se puede seguir editando igual.
 */
export function IncomeTab({
  companyId,
  weekStart,
  incomeDays,
  defaultDailyIncome,
}: {
  companyId: string;
  weekStart: IsoDate;
  incomeDays: Array<{ date: IsoDate; amount: number }>;
  defaultDailyIncome: number;
}) {
  const dates = weekDatesSundayToSaturday(weekStart);
  const byDate = new Map(incomeDays.map((d) => [d.date, d.amount]));
  const [amounts, setAmounts] = useState<Record<IsoDate, string>>(
    Object.fromEntries(
      dates.map((date) => [date, String(byDate.get(date) ?? defaultDailyIncome)]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const save = () => {
    startTransition(async () => {
      const result = await saveIncomeProjection({
        companyId,
        days: dates.map((date) => ({ date, amount: Number(amounts[date]) || 0 })),
      });
      setMessage("error" in result ? result.error : "Proyección guardada.");
      if (!("error" in result)) router.refresh();
    });
  };

  return (
    <SurfaceCard>
      <h2 className="text-base font-semibold">THIS WEEK -- Ingresos proyectados</h2>
      <p className="text-muted-foreground text-sm">
        Domingo a sábado. El lunes queda excluido del Financial Report (ya
        está reflejado por otro lado), pero se puede editar igual.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {dates.map((date, index) => (
          <label key={date} className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">
              {formatDayLabel(date)}
              {index === 1 ? " (excluido)" : ""}
            </span>
            <Input
              inputMode="decimal"
              value={amounts[date]}
              onChange={(event) =>
                setAmounts((current) => ({ ...current, [date]: event.target.value }))
              }
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          Guardar proyección
        </Button>
        {message ? <span className="text-muted-foreground text-sm">{message}</span> : null}
      </div>
    </SurfaceCard>
  );
}
