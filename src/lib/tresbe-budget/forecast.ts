// Generación del presupuesto de una semana a partir de los supuestos
// configurables. Reemplaza el copiar-y-pegar entre las dos planillas.

import {
  addDays,
  isoWeekday,
  weekDates,
  weekNumber,
  type IsoDate,
} from "./dates";

export type ForecastSettings = {
  week_one_start: IsoDate;
  processor_fee_rate: number;
  loan_holdback_rate: number;
  card_settlement_lag_days: number;
  payroll_amount: number;
  payroll_weekday: number;
  related_cash_out_amount: number;
  related_cash_out_enabled: boolean;
  payroll_tax_rate: number;
  payroll_tax_offset_days: number;
};

export type ForecastSalesPattern = {
  weekday: number;
  gross_sales: number;
  card_share: number;
};

export type ForecastRecurringDebit = {
  concept: string;
  category_id: string;
  amount: number;
  frequency: "semanal" | "quincenal" | "mensual";
  weekday: number | null;
  day_of_month: number | null;
  weekend_shift: "ninguno" | "viernes_anterior" | "lunes_siguiente";
  is_active: boolean;
};

export type ForecastVendor = {
  vendor_name: string;
  category_id: string;
  weekday: number;
  amount: number;
  is_active: boolean;
};

export type ForecastCategoryIds = {
  creditCard: string;
  cash: string;
  payroll: string;
  payrollTaxes: string;
};

export type ForecastedEntry = {
  categoryId: string;
  entryDate: IsoDate;
  amount: number;
  sources: string[];
};

const round = (value: number) => Math.round(value * 100) / 100;

function weekendShift(
  date: IsoDate,
  shift: "ninguno" | "viernes_anterior" | "lunes_siguiente",
): IsoDate {
  const weekday = isoWeekday(date);
  if (weekday < 6 || shift === "ninguno") return date;
  if (shift === "viernes_anterior") return addDays(date, 5 - weekday);
  return addDays(date, 8 - weekday);
}

export function buildForecastForWeek({
  weekStart,
  settings,
  salesPattern,
  recurringDebits,
  vendors,
  categoryIds,
}: {
  weekStart: IsoDate;
  settings: ForecastSettings;
  salesPattern: ForecastSalesPattern[];
  recurringDebits: ForecastRecurringDebit[];
  vendors: ForecastVendor[];
  categoryIds: ForecastCategoryIds;
}): ForecastedEntry[] {
  const dates = weekDates(weekStart);
  const patternByWeekday = new Map(
    salesPattern.map((row) => [row.weekday, row]),
  );
  const accumulator = new Map<string, ForecastedEntry>();

  const add = (
    categoryId: string,
    entryDate: IsoDate,
    amount: number,
    source: string,
  ) => {
    if (!categoryId || amount <= 0) return;
    const key = `${categoryId}|${entryDate}`;
    const current = accumulator.get(key);
    if (current) {
      current.amount = round(current.amount + amount);
      current.sources.push(source);
      return;
    }
    accumulator.set(key, {
      categoryId,
      entryDate,
      amount: round(amount),
      sources: [source],
    });
  };

  const cardNetRate =
    (1 - Number(settings.processor_fee_rate)) *
    (1 - Number(settings.loan_holdback_rate));

  for (const date of dates) {
    // Efectivo: disponible el mismo día.
    const sameDay = patternByWeekday.get(isoWeekday(date));
    if (sameDay) {
      const cash =
        Number(sameDay.gross_sales) * (1 - Number(sameDay.card_share));
      add(categoryIds.cash, date, round(cash), "Ventas en efectivo");
    }
    // Tarjeta: la venta de hace `lag` días, neta de comisión y retención.
    const soldOn = addDays(date, -Number(settings.card_settlement_lag_days));
    const source = patternByWeekday.get(isoWeekday(soldOn));
    if (source) {
      const card = Number(source.gross_sales) * Number(source.card_share);
      add(
        categoryIds.creditCard,
        date,
        round(card * cardNetRate),
        `Ventas con tarjeta del ${soldOn} netas de comisión y retención`,
      );
    }
  }

  // Nómina y su payroll tax, que cae el día hábil siguiente (el desfase que la
  // planilla original pegaba mal).
  const payrollDate = dates[Number(settings.payroll_weekday) - 1];
  if (payrollDate) {
    const payroll =
      Number(settings.payroll_amount) +
      (settings.related_cash_out_enabled
        ? Number(settings.related_cash_out_amount)
        : 0);
    add(categoryIds.payroll, payrollDate, round(payroll), "Nómina proyectada");
    const taxDate = addDays(
      payrollDate,
      Number(settings.payroll_tax_offset_days),
    );
    if (dates.includes(taxDate)) {
      add(
        categoryIds.payrollTaxes,
        taxDate,
        round(
          Number(settings.payroll_amount) * Number(settings.payroll_tax_rate),
        ),
        "Payroll tax sobre la nómina de la semana",
      );
    }
  }

  const number = weekNumber(settings.week_one_start, weekStart);
  for (const debit of recurringDebits) {
    if (!debit.is_active || Number(debit.amount) <= 0) continue;
    let date: IsoDate | null = null;
    if (debit.frequency === "semanal" && debit.weekday) {
      date = dates[debit.weekday - 1];
    } else if (debit.frequency === "quincenal" && debit.weekday) {
      if (number % 2 === 1) date = dates[debit.weekday - 1];
    } else if (debit.frequency === "mensual" && debit.day_of_month) {
      date =
        dates.find(
          (value) => Number(value.slice(8, 10)) === debit.day_of_month,
        ) ?? null;
    }
    if (!date) continue;
    const shifted = weekendShift(date, debit.weekend_shift);
    if (!dates.includes(shifted)) continue;
    add(debit.category_id, shifted, round(Number(debit.amount)), debit.concept);
  }

  for (const vendor of vendors) {
    if (!vendor.is_active || Number(vendor.amount) <= 0) continue;
    const date = dates[vendor.weekday - 1];
    if (!date) continue;
    add(
      vendor.category_id,
      date,
      round(Number(vendor.amount)),
      vendor.vendor_name,
    );
  }

  return [...accumulator.values()].sort(
    (a, b) =>
      a.entryDate.localeCompare(b.entryDate) ||
      a.categoryId.localeCompare(b.categoryId),
  );
}
