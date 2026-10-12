"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  deleteHoliday,
  deleteVendorConfig,
  saveCutMeatSettings,
  saveHoliday,
  saveVendorConfig,
} from "@/actions/cutmeat-daily";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import type {
  CutMeatHoliday,
  CutMeatSettings,
  CutMeatVendorConfig,
} from "@/services/cutmeat-daily";

const selectClass =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px]";

export function SettingsTab({
  companyId,
  vendorConfig,
  holidays,
  settings,
}: {
  companyId: string;
  vendorConfig: CutMeatVendorConfig[];
  holidays: CutMeatHoliday[];
  settings: CutMeatSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [newVendor, setNewVendor] = useState("");
  const [newVendorInclusion, setNewVendorInclusion] = useState<"included" | "excluded">(
    "included",
  );
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayLabel, setNewHolidayLabel] = useState("");

  const [settingsForm, setSettingsForm] = useState({
    primeMeatsBalance: String(settings.primeMeatsBalance),
    primeMeatsRecurring: String(settings.primeMeatsRecurring),
    defaultDailyIncome: String(settings.defaultDailyIncome),
    flatWeeklyIncome: String(settings.flatWeeklyIncome),
  });

  const addVendor = () => {
    if (!newVendor.trim()) return;
    startTransition(async () => {
      const result = await saveVendorConfig({
        companyId,
        vendorName: newVendor.trim(),
        inclusion: newVendorInclusion,
      });
      if ("error" in result) setMessage(result.error);
      else {
        setNewVendor("");
        router.refresh();
      }
    });
  };

  const removeVendor = (id: string) => {
    startTransition(async () => {
      await deleteVendorConfig({ companyId, id });
      router.refresh();
    });
  };

  const addHoliday = () => {
    if (!newHolidayDate) return;
    startTransition(async () => {
      const result = await saveHoliday({
        companyId,
        holidayDate: newHolidayDate,
        label: newHolidayLabel.trim() || null,
      });
      if ("error" in result) setMessage(result.error);
      else {
        setNewHolidayDate("");
        setNewHolidayLabel("");
        router.refresh();
      }
    });
  };

  const removeHoliday = (id: string) => {
    startTransition(async () => {
      await deleteHoliday({ companyId, id });
      router.refresh();
    });
  };

  const saveSettings = () => {
    startTransition(async () => {
      const result = await saveCutMeatSettings({
        companyId,
        primeMeatsBalance: Number(settingsForm.primeMeatsBalance) || 0,
        primeMeatsRecurring: Number(settingsForm.primeMeatsRecurring) || 0,
        defaultDailyIncome: Number(settingsForm.defaultDailyIncome) || 0,
        flatWeeklyIncome: Number(settingsForm.flatWeeklyIncome) || 0,
      });
      setMessage("error" in result ? result.error : "Configuración guardada.");
    });
  };

  return (
    <div className="space-y-6">
      <SurfaceCard>
        <h2 className="text-base font-semibold">Prime Meats e ingresos por defecto</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Saldo de Prime Meats</span>
            <Input
              inputMode="decimal"
              value={settingsForm.primeMeatsBalance}
              onChange={(e) =>
                setSettingsForm((c) => ({ ...c, primeMeatsBalance: e.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Recurrentes de Prime Meats</span>
            <Input
              inputMode="decimal"
              value={settingsForm.primeMeatsRecurring}
              onChange={(e) =>
                setSettingsForm((c) => ({ ...c, primeMeatsRecurring: e.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">Ingreso diario por defecto</span>
            <Input
              inputMode="decimal"
              value={settingsForm.defaultDailyIncome}
              onChange={(e) =>
                setSettingsForm((c) => ({ ...c, defaultDailyIncome: e.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground text-xs">
              Ingreso plano semanal (14/21-day)
            </span>
            <Input
              inputMode="decimal"
              value={settingsForm.flatWeeklyIncome}
              onChange={(e) =>
                setSettingsForm((c) => ({ ...c, flatWeeklyIncome: e.target.value }))
              }
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={saveSettings} disabled={pending}>
            Guardar configuración
          </Button>
          {message ? <span className="text-muted-foreground text-sm">{message}</span> : null}
        </div>
      </SurfaceCard>

      <SurfaceCard padding="sm">
        <h2 className="px-1 text-base font-semibold">
          Proveedores del aging (incluidos / excluidos)
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
          <Input
            placeholder="Nombre del proveedor"
            value={newVendor}
            onChange={(e) => setNewVendor(e.target.value)}
            className="max-w-xs"
          />
          <select
            className={`${selectClass} max-w-40`}
            value={newVendorInclusion}
            onChange={(e) => setNewVendorInclusion(e.target.value as "included" | "excluded")}
          >
            <option value="included">Incluido</option>
            <option value="excluded">Excluido</option>
          </select>
          <Button size="sm" variant="outline" disabled={pending} onClick={addVendor}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
        <div className="mt-3 grid gap-1 px-1">
          {vendorConfig.map((vendor) => (
            <div key={vendor.id} className="flex items-center justify-between text-sm">
              <span>
                {vendor.vendorName}{" "}
                <span className="text-muted-foreground text-xs">
                  ({vendor.inclusion === "included" ? "incluido" : "excluido"})
                </span>
              </span>
              <button
                type="button"
                aria-label="Eliminar"
                disabled={pending}
                className="text-muted-foreground hover:text-destructive p-1"
                onClick={() => removeVendor(vendor.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {vendorConfig.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin proveedores configurados.</p>
          ) : null}
        </div>
      </SurfaceCard>

      <SurfaceCard padding="sm">
        <h2 className="px-1 text-base font-semibold">Feriados (fecha sugerida del informe)</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
          <Input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="max-w-48"
          />
          <Input
            placeholder="Etiqueta (opcional)"
            value={newHolidayLabel}
            onChange={(e) => setNewHolidayLabel(e.target.value)}
            className="max-w-xs"
          />
          <Button size="sm" variant="outline" disabled={pending} onClick={addHoliday}>
            <Plus className="size-4" />
            Agregar
          </Button>
        </div>
        <div className="mt-3 grid gap-1 px-1">
          {holidays.map((holiday) => (
            <div key={holiday.id} className="flex items-center justify-between text-sm">
              <span>
                {holiday.holidayDate}
                {holiday.label ? ` -- ${holiday.label}` : ""}
              </span>
              <button
                type="button"
                aria-label="Eliminar"
                disabled={pending}
                className="text-muted-foreground hover:text-destructive p-1"
                onClick={() => removeHoliday(holiday.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {holidays.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin feriados configurados.</p>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
