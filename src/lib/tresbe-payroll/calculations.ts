export type TresbePayrollRule =
  | "unconfigured"
  | "standard_hourly_40_plus_services"
  | "preset_40_hourly"
  | "full_services"
  | "preset_40_weekly_salary"
  | "fixed_weekly_salary"
  | "custom_manual";

export type TresbeCalculationInput = {
  payrollRule: TresbePayrollRule;
  totalWeeklyHours: number;
  regularRate: number | null;
  serviceRate: number | null;
  weeklySalary: number | null;
  manualSystemAmount: number;
  tips: number;
  fixedServiceAmount: number;
  otherAdjustments: number;
};

export type TresbeCalculation = {
  systemHours: number;
  serviceHours: number;
  systemPay: number;
  serviceCheckAmount: number;
  employeeTotal: number;
};

const cents = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function calculateTresbeEntry(
  input: TresbeCalculationInput,
): TresbeCalculation {
  const hours = Math.max(0, Number(input.totalWeeklyHours || 0));
  const regularRate = Math.max(0, Number(input.regularRate || 0));
  const serviceRate = Math.max(
    0,
    Number(input.serviceRate ?? input.regularRate ?? 0),
  );
  let systemHours = 0;
  let serviceHours = 0;
  let systemPay = 0;
  let serviceCheckAmount = 0;

  switch (input.payrollRule) {
    case "unconfigured":
      break;
    case "standard_hourly_40_plus_services":
    case "preset_40_hourly":
      systemHours = Math.min(hours, 40);
      serviceHours = Math.max(hours - 40, 0);
      systemPay = cents(systemHours * regularRate);
      serviceCheckAmount =
        serviceHours > 0 && input.fixedServiceAmount > 0
          ? cents(input.fixedServiceAmount)
          : cents(serviceHours * serviceRate);
      break;
    case "full_services":
      serviceHours = hours;
      serviceCheckAmount =
        input.fixedServiceAmount > 0
          ? cents(input.fixedServiceAmount)
          : Number(input.weeklySalary || 0) > 0
            ? cents(Number(input.weeklySalary))
            : cents(serviceHours * serviceRate);
      break;
    case "preset_40_weekly_salary":
    case "fixed_weekly_salary":
      systemHours = hours;
      systemPay = cents(Number(input.weeklySalary || 0));
      break;
    case "custom_manual":
      systemHours = hours;
      systemPay = cents(Math.max(0, Number(input.manualSystemAmount || 0)));
      serviceCheckAmount = cents(
        Math.max(0, Number(input.fixedServiceAmount || 0)),
      );
      break;
  }

  return {
    systemHours,
    serviceHours,
    systemPay,
    serviceCheckAmount,
    employeeTotal: cents(
      systemPay +
        Number(input.tips || 0) +
        serviceCheckAmount +
        Number(input.otherAdjustments || 0),
    ),
  };
}

export function sumTresbePayroll(
  entries: Array<TresbeCalculationInput & { employeeTotal?: number }>,
) {
  return entries.reduce(
    (totals, entry) => {
      const calculated = calculateTresbeEntry(entry);
      totals.employeeCount += 1;
      totals.totalWeeklyHours += Number(entry.totalWeeklyHours || 0);
      totals.totalSystemHours += calculated.systemHours;
      totals.totalServiceHours += calculated.serviceHours;
      totals.totalSystemPay += calculated.systemPay;
      totals.totalTips += Number(entry.tips || 0);
      totals.totalServiceChecks += calculated.serviceCheckAmount;
      totals.totalAdjustments += Number(entry.otherAdjustments || 0);
      totals.grandTotal += calculated.employeeTotal;
      return totals;
    },
    {
      employeeCount: 0,
      totalWeeklyHours: 0,
      totalSystemHours: 0,
      totalServiceHours: 0,
      totalSystemPay: 0,
      totalTips: 0,
      totalServiceChecks: 0,
      totalAdjustments: 0,
      grandTotal: 0,
    },
  );
}

export const TRESBE_RULE_LABELS: Record<TresbePayrollRule, string> = {
  unconfigured: "Sin configurar",
  standard_hourly_40_plus_services: "Por hora · 40 + servicios",
  preset_40_hourly: "Por hora · 40 predeterminadas",
  full_services: "Servicios completos",
  preset_40_weekly_salary: "40 horas · salario semanal",
  fixed_weekly_salary: "Salario semanal fijo",
  custom_manual: "Manual excepcional",
};
