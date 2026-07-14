"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createInvoiceFromRecurringProfile,
  saveRecurringInvoiceProfile,
} from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { BillingCompany, RecurringInvoiceProfile } from "@/types/invoices";

export function RecurringBilling({
  profiles,
  companies,
  today,
}: {
  profiles: RecurringInvoiceProfile[];
  companies: BillingCompany[];
  today: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const due = profiles.filter(
    (profile) =>
      profile.enabled &&
      profile.next_generation_date &&
      profile.next_generation_date <= today,
  );
  function run(
    action: () => Promise<{
      error?: string;
      invoiceId?: string;
      success?: boolean;
    }>,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.error) setMessage(result.error);
      else if (result.invoiceId)
        router.push(`/dashboard/admin/invoices/${result.invoiceId}`);
      else {
        setMessage("Perfil guardado.");
        router.refresh();
      }
    });
  }
  return (
    <SurfaceCard padding="sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Preparación recurrente</h2>
          <p className="text-muted-foreground text-sm">
            Solo prepara borradores; nunca emite ni envía automáticamente.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm((value) => !value)}
        >
          Nuevo perfil
        </Button>
      </div>
      {message ? (
        <p className="text-muted-foreground mt-3 text-sm">{message}</p>
      ) : null}
      {showForm ? (
        <form
          className="mt-5 grid gap-3 rounded-xl border p-4 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            let items: Array<{
              description: string;
              quantity: number;
              unitPrice: number;
            }>;
            try {
              items = JSON.parse(String(form.get("items") || "[]"));
            } catch {
              return setMessage("Las partidas JSON no son válidas.");
            }
            run(() =>
              saveRecurringInvoiceProfile({
                companyId: String(form.get("companyId")),
                name: String(form.get("name")),
                frequency: String(form.get("frequency")) as
                  "weekly" | "biweekly" | "monthly" | "custom",
                weekday: Number(form.get("weekday") || 0),
                nextGenerationDate:
                  String(form.get("nextGenerationDate")) || null,
                defaultItems: items,
                defaultTermsDays: Number(form.get("terms") || 15),
                billingEmail: String(form.get("email") || "") || null,
                enabled: true,
              }),
            );
          }}
        >
          <select
            name="companyId"
            className="bg-background h-9 rounded-md border px-3 text-sm"
            required
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <Input name="name" placeholder="Nombre del perfil" required />
          <select
            name="frequency"
            className="bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quincenal</option>
            <option value="monthly">Mensual</option>
            <option value="custom">Personalizado</option>
          </select>
          <Input
            name="weekday"
            type="number"
            min="0"
            max="6"
            defaultValue="1"
            aria-label="Día de semana"
          />
          <Input name="nextGenerationDate" type="date" defaultValue={today} />
          <Input
            name="terms"
            type="number"
            min="0"
            defaultValue="15"
            aria-label="Términos"
          />
          <Input
            name="email"
            type="email"
            placeholder="Correo de facturación"
          />
          <textarea
            name="items"
            className="bg-background min-h-24 rounded-md border px-3 py-2 font-mono text-xs md:col-span-2"
            defaultValue={
              '[{"description":"Paquete de servicios administrativos","quantity":1,"unitPrice":0}]'
            }
          />
          <Button type="submit" disabled={pending}>
            Guardar perfil
          </Button>
        </form>
      ) : null}
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {due.map((profile) => (
          <div key={profile.id} className="rounded-xl border p-4 text-sm">
            <div className="flex justify-between gap-3">
              <strong>{profile.name}</strong>
              <span className="text-muted-foreground">{profile.frequency}</span>
            </div>
            <p className="text-muted-foreground mt-1">
              {profile.companies?.name} · pendiente desde{" "}
              {profile.next_generation_date}
            </p>
            <Button
              className="mt-3"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => createInvoiceFromRecurringProfile(profile.id))
              }
            >
              Crear factura de esta semana
            </Button>
          </div>
        ))}
        {!due.length ? (
          <p className="text-muted-foreground text-sm">
            No hay facturas recurrentes pendientes.
          </p>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
