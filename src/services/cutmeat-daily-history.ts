import type { IsoDate } from "@/lib/cutmeat-daily/dates";
import { createClient } from "@/lib/supabase/server";

export type CutMeatDailyHistoryRow = {
  id: string;
  companyId: string;
  reportDate: IsoDate;
  statementBalance: number;
  unclearedChecksAsOf: number;
  unclearedChecksAfter: number;
  unclearedDepositsAsOf: number;
  unclearedDepositsAfter: number;
  registerBalance: number;
  recurrentesPrior: number;
  recurrentesWeek: number;
  balanceAfterWeekly: number;
  balanceGabriel: number;
  agingVendorsTotal: number | null;
  agingCustomersTotal: number | null;
  source: string;
  pdfSourceId: string | null;
  /** Gabriel[día] − Balance after Weekly Payments del día anterior cargado
   * (debería ser 0 salvo el primer día de la tabla, que usa el valor del
   * PDF y no tiene día anterior para comparar). */
  diffFromPriorBalance: number | null;
};

const round = (value: number) => Math.round(value * 100) / 100;

export async function getDailyHistory(companyId: string): Promise<CutMeatDailyHistoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_daily_history")
    .select("*")
    .eq("company_id", companyId)
    .order("report_date", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    reportDate: row.report_date as IsoDate,
    statementBalance: Number(row.statement_balance),
    unclearedChecksAsOf: Number(row.uncleared_checks_as_of),
    unclearedChecksAfter: Number(row.uncleared_checks_after),
    unclearedDepositsAsOf: Number(row.uncleared_deposits_as_of),
    unclearedDepositsAfter: Number(row.uncleared_deposits_after),
    registerBalance: Number(row.register_balance),
    recurrentesPrior: Number(row.recurrentes_prior),
    recurrentesWeek: Number(row.recurrentes_week),
    balanceAfterWeekly: Number(row.balance_after_weekly),
    balanceGabriel: Number(row.balance_gabriel),
    agingVendorsTotal: row.aging_vendors_total == null ? null : Number(row.aging_vendors_total),
    agingCustomersTotal:
      row.aging_customers_total == null ? null : Number(row.aging_customers_total),
    source: row.source,
    pdfSourceId: row.pdf_source_id,
    diffFromPriorBalance: null as number | null,
  }));

  return rows
    .sort((a, b) => (a.reportDate < b.reportDate ? -1 : 1))
    .map((row, index) => {
      const previous = rows[index - 1];
      if (!previous) return row;
      return {
        ...row,
        diffFromPriorBalance: round(row.balanceGabriel - previous.balanceAfterWeekly),
      };
    })
    .reverse();
}
