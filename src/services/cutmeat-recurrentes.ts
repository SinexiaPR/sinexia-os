import { notFound, redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/session";
import type { IsoDate } from "@/lib/cutmeat-daily/dates";
import { createClient } from "@/lib/supabase/server";
import { resolveCutMeatCompany } from "@/services/cutmeat-daily";

export { resolveCutMeatCompany };

export type CutMeatRecurrente = {
  id: string;
  companyId: string;
  period: IsoDate;
  fecha: IsoDate | null;
  trType: string | null;
  num: string | null;
  vendor: string;
  dueDate: IsoDate | null;
  amount: number;
  pagado: boolean;
  paidDate: IsoDate | null;
  paidAmount: number | null;
  notes: string | null;
  updatedAt: string;
};

/**
 * Admin: lectura y escritura. El cliente de Cut Meat Distributors (Gabriel,
 * el dueño): solo lectura. Nadie más puede entrar -- ni admin de otra
 * sesión sin rol admin, ni cliente de otra empresa.
 */
export async function requireCutMeatAccess(companyId: string) {
  const profile = await requireAuth();
  const company = await resolveCutMeatCompany(companyId);
  if (!company) notFound();
  const isOwnClient = profile.role === "client" && profile.company_id === company.id;
  if (profile.role !== "admin" && !isOwnClient) redirect("/dashboard");
  return { profile, company, canWrite: profile.role === "admin" };
}

export async function getRecurrentesForPeriod(
  companyId: string,
  period: IsoDate,
): Promise<CutMeatRecurrente[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_recurrentes")
    .select("*")
    .eq("company_id", companyId)
    .eq("period", period)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("vendor");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    period: row.period,
    fecha: row.fecha,
    trType: row.tr_type,
    num: row.num,
    vendor: row.vendor,
    dueDate: row.due_date,
    amount: Number(row.amount),
    pagado: row.pagado,
    paidDate: row.paid_date,
    paidAmount: row.paid_amount == null ? null : Number(row.paid_amount),
    notes: row.notes,
    updatedAt: row.updated_at,
  }));
}

/** Meses con al menos un recurrente cargado, para el selector -- más
 * reciente primero. */
export async function getAvailablePeriods(companyId: string): Promise<IsoDate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_recurrentes")
    .select("period")
    .eq("company_id", companyId)
    .order("period", { ascending: false });
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => row.period as IsoDate)));
}
