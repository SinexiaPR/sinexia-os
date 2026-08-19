import type { TresbePayroll, TresbePayrollEntry } from "@/services/tresbe-payroll";

// Live replacement for the "% sobre venta" page Maria used to compute by
// hand (with Claude Cowork) and paste into tresbe_payroll_analysis -- that
// JSON went stale every time the payroll was recalculated or corrected
// after she pasted it. Everything here is derived straight from
// tresbe_payrolls / tresbe_payroll_entries at PDF-generation time, so the
// printed page always matches the payroll it's attached to.

const HOURLY_RULES = new Set([
  "standard_hourly_40_plus_services",
  "preset_40_hourly",
]);

/**
 * A "non-payroll" line: a fixed/manual services check on an hourly
 * employee with zero overtime hours behind it. Real overtime-based service
 * pay always has service_hours > 0 for these two rules -- a flat amount
 * with no hours to justify it (e.g. a reimbursement routed through the
 * services check, like Fernando Almonte's purchase reimbursement) is the
 * one structural signal available that doesn't depend on the employee's
 * name or a free-text comment.
 */
export function isNonPayrollServiceEntry(entry: TresbePayrollEntry) {
  return (
    HOURLY_RULES.has(entry.payroll_rule_snapshot) &&
    Number(entry.service_hours) === 0 &&
    Number(entry.service_check_amount) > 0
  );
}

export type TresbeMarginDeduction = {
  concepto: string;
  importe: number;
};

export type TresbeMarginAnalysis = {
  venta: {
    tresbeCafeConCe: number;
    calleCerra: number;
    total: number;
  };
  tresbe: {
    nominaBase: number;
    deducciones: TresbeMarginDeduction[];
    tips: number;
    nominaSinPropina: number;
  };
  calleCerra: {
    nominaSinPropina: number;
    tips: number;
    hasData: boolean;
  };
  combinado: {
    nominaSinPropina: number;
    porcentajeSobreVentaTotal: number;
  };
  porcentajeSobreVentaTotalPorNegocio: {
    tresbe: number;
    calleCerra: number;
  };
  porcentajePropio: {
    tresbe: number | null;
    calleCerra: number | null;
  };
};

export function computeTresbeMarginAnalysis(
  payroll: TresbePayroll,
  entries: TresbePayrollEntry[],
): TresbeMarginAnalysis {
  const deducciones: TresbeMarginDeduction[] = entries
    .filter(isNonPayrollServiceEntry)
    .map((entry) => ({
      concepto:
        entry.comment?.trim() ||
        `${entry.employee_name_snapshot} - cheque de servicios sin horas`,
      importe: -Number(entry.service_check_amount),
    }));
  const deduccionesTotal = deducciones.reduce((sum, d) => sum + d.importe, 0);

  const nominaBase = Number(payroll.grand_total);
  const tips = Number(payroll.total_tips);
  const tresbeNominaSinPropina = round2(nominaBase + deduccionesTotal - tips);

  const calleCerraNominaSinPropina = Number(
    payroll.calle_cerra_nomina_sin_propina ?? 0,
  );
  const calleCerraTips = Number(payroll.calle_cerra_tips ?? 0);
  const calleCerraHasData =
    payroll.calle_cerra_nomina_sin_propina != null ||
    payroll.calle_cerra_tips != null;

  const ventaTresbeCafeConCe = round2(
    Number(payroll.sales_tresbe) + Number(payroll.sales_cafe_con_ce),
  );
  const ventaCalleCerra = Number(payroll.sales_cafe_con_ce_calle_cerra);
  const ventaTotal = round2(ventaTresbeCafeConCe + ventaCalleCerra);

  const combinadoNominaSinPropina = round2(
    tresbeNominaSinPropina + calleCerraNominaSinPropina,
  );

  return {
    venta: {
      tresbeCafeConCe: ventaTresbeCafeConCe,
      calleCerra: ventaCalleCerra,
      total: ventaTotal,
    },
    tresbe: {
      nominaBase,
      deducciones,
      tips,
      nominaSinPropina: tresbeNominaSinPropina,
    },
    calleCerra: {
      nominaSinPropina: calleCerraNominaSinPropina,
      tips: calleCerraTips,
      hasData: calleCerraHasData,
    },
    combinado: {
      nominaSinPropina: combinadoNominaSinPropina,
      porcentajeSobreVentaTotal: percentOf(
        combinadoNominaSinPropina,
        ventaTotal,
      ),
    },
    porcentajeSobreVentaTotalPorNegocio: {
      tresbe: percentOf(tresbeNominaSinPropina, ventaTotal),
      calleCerra: percentOf(calleCerraNominaSinPropina, ventaTotal),
    },
    porcentajePropio: {
      tresbe:
        ventaTresbeCafeConCe > 0
          ? percentOf(tresbeNominaSinPropina, ventaTresbeCafeConCe)
          : null,
      calleCerra:
        ventaCalleCerra > 0
          ? percentOf(calleCerraNominaSinPropina, ventaCalleCerra)
          : null,
    },
  };
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function percentOf(part: number, whole: number) {
  return whole > 0 ? round2((part / whole) * 100) : 0;
}
