import { compareLatestDocuments } from "@/lib/intelligence/comparison";
import {
  buildQuickBooksARAnalyticalSummary,
  isQuickBooksARProfile,
  type QuickBooksARCustomer,
  type QuickBooksARProfile,
} from "@/lib/intelligence/extractors/quickbooks-ar";
import {
  detectQueryIntent,
  requiresOpenAI,
  type QueryIntent,
} from "@/lib/intelligence/intents";
import { getProfilesForCompany } from "@/lib/intelligence/profiles/store";
import { createClient } from "@/lib/supabase/server";
import type { PayrollEmployeeSummary } from "@/lib/intelligence/profiles/types";
import type { SourceReference } from "@/lib/intelligence/types";

type StructuredAnswer = {
  answered: boolean;
  message: string;
  sources: SourceReference[];
  intent: QueryIntent;
};

async function answerFromTresbePayroll(
  params: {
    question: string;
    companyId: string;
    period?: string | null;
  },
  intent: QueryIntent,
): Promise<StructuredAnswer | null> {
  const payrollIntents = new Set<QueryIntent>([
    "payroll_total",
    "employee_count",
    "most_hours_worked",
    "total_hours",
    "overtime_hours",
    "total_tips",
    "service_checks_total",
    "service_check_recipients",
    "summary",
  ]);
  if (
    !payrollIntents.has(intent) ||
    (intent === "summary" && !/n[oó]mina|payroll/i.test(params.question))
  )
    return null;

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("slug")
    .eq("id", params.companyId)
    .maybeSingle();
  if (company?.slug !== "tresbe") return null;

  let query = supabase
    .from("tresbe_payrolls")
    .select("*")
    .eq("company_id", params.companyId)
    .order("sent_at", { ascending: false })
    .limit(1);
  if (params.period) query = query.eq("week_start", params.period);
  const { data: payrolls } = await query;
  const payroll = payrolls?.[0];
  if (!payroll) return null;
  const { data: entries } = await supabase
    .from("tresbe_payroll_entries")
    .select(
      "employee_name_snapshot,total_weekly_hours,service_hours,service_check_amount,tips,employee_total",
    )
    .eq("payroll_id", payroll.id)
    .order("employee_name_snapshot");
  const rows = entries ?? [];
  let message: string;
  switch (intent) {
    case "payroll_total":
      message = `Total general de la nómina: ${formatMoney(payroll.grand_total)}. Nómina en sistema: ${formatMoney(payroll.total_system_pay)}; tips: ${formatMoney(payroll.total_tips)}; cheques de servicios: ${formatMoney(payroll.total_service_checks)}.`;
      break;
    case "employee_count":
      message = formatCount(payroll.employee_count, "Empleados");
      break;
    case "total_hours":
      message = formatCount(payroll.total_weekly_hours, "Horas totales");
      break;
    case "overtime_hours": {
      const over = rows.filter((row) => Number(row.total_weekly_hours) > 40);
      message = over.length
        ? `Empleados sobre 40 horas:\n${over.map((row) => `• ${row.employee_name_snapshot}: ${row.total_weekly_hours} horas`).join("\n")}`
        : "Ningún empleado superó 40 horas en esta nómina.";
      break;
    }
    case "total_tips":
      message = `Propinas: ${formatMoney(payroll.total_tips)}.`;
      break;
    case "service_checks_total":
      message = `Total de cheques de servicios: ${formatMoney(payroll.total_service_checks)}.`;
      break;
    case "service_check_recipients": {
      const services = rows.filter(
        (row) => Number(row.service_check_amount) > 0,
      );
      message = services.length
        ? `Empleados con cheque de servicios:\n${services.map((row) => `• ${row.employee_name_snapshot}: ${formatMoney(row.service_check_amount)}`).join("\n")}`
        : "No hubo cheques de servicios en esta nómina.";
      break;
    }
    case "most_hours_worked": {
      const ranked = [...rows].sort(
        (a, b) => Number(b.total_weekly_hours) - Number(a.total_weekly_hours),
      );
      message = ranked.length
        ? `Quién trabajó más horas:\n${ranked
            .slice(0, 5)
            .map(
              (row, index) =>
                `${index + 1}. ${row.employee_name_snapshot}: ${row.total_weekly_hours} horas`,
            )
            .join("\n")}`
        : "No hay horas registradas.";
      break;
    }
    case "summary":
      message = [
        `Nómina Tresbe del ${payroll.week_start} al ${payroll.week_end}.`,
        `Empleados: ${payroll.employee_count}. Horas: ${payroll.total_weekly_hours}.`,
        `Nómina en sistema: ${formatMoney(payroll.total_system_pay)}.`,
        `Tips: ${formatMoney(payroll.total_tips)}.`,
        `Cheques de servicios: ${formatMoney(payroll.total_service_checks)}.`,
        `Ajustes: ${formatMoney(payroll.total_adjustments)}.`,
        `Total general: ${formatMoney(payroll.grand_total)}.`,
      ].join("\n");
      break;
    default:
      return null;
  }
  const source = {
    title: `Nómina Tresbe ${payroll.week_start} al ${payroll.week_end}`,
    period: `${payroll.week_start}/${payroll.week_end}`,
    viewPath: `/dashboard/payroll?payroll=${payroll.id}`,
    downloadPath: `/api/tresbe-payroll/${payroll.id}/pdf`,
  };
  return { answered: true, message, sources: [source], intent };
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "no disponible (confianza baja)";
  }
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCount(value: number | null | undefined, label: string): string {
  if (value == null || Number.isNaN(value)) {
    return `${label}: no disponible (confianza baja).`;
  }
  return `${label}: ${value.toLocaleString("en-US")}.`;
}

function profileSources(
  profiles: Array<{
    report_id: string | null;
    document_id: string | null;
    period: string | null;
    summary: string | null;
    document_processing?: unknown;
  }>,
): SourceReference[] {
  return profiles.slice(0, 3).map((p) => {
    const proc = p.document_processing as {
      reports?: { title?: string };
      documents?: { supplier?: string; document_type?: string };
    } | null;
    const title =
      proc?.reports?.title ??
      (proc?.documents
        ? `${proc.documents.document_type} · ${proc.documents.supplier}`
        : p.summary) ??
      "Documento";
    return {
      reportId: p.report_id ?? undefined,
      documentId: p.document_id ?? undefined,
      title,
      period: p.period,
      viewPath: p.report_id
        ? `/dashboard/reports?highlight=${p.report_id}`
        : "/dashboard/inbox",
      downloadPath: p.report_id
        ? `/api/reports/${p.report_id}/download`
        : undefined,
    };
  });
}

function readField(data: Record<string, unknown>, key: string): number | null {
  const value = data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPayrollEmployees(
  data: Record<string, unknown>,
): PayrollEmployeeSummary[] {
  if (!Array.isArray(data.employees)) return [];
  return data.employees.filter(
    (entry): entry is PayrollEmployeeSummary =>
      typeof entry === "object" &&
      entry != null &&
      typeof (entry as PayrollEmployeeSummary).name === "string",
  );
}

function answerQuickBooksAR(
  intent: QueryIntent,
  data: QuickBooksARProfile,
): string | null {
  const customers = Array.isArray(data.customers) ? data.customers : [];

  switch (intent) {
    case "receivable_total":
      return `El total pendiente por cobrar es ${formatMoney(data.total_receivable ?? data.grand_total)}.`;
    case "customer_count":
      return formatCount(data.customer_count ?? customers.length, "Clientes");
    case "invoice_count_receivable":
      return formatCount(data.invoice_count, "Facturas");
    case "top_debtors": {
      if (!customers.length) {
        return "No customer balances were extracted from this receivable report.";
      }
      const top = customers.slice(0, 5);
      const lines = top.map(
        (c, i) =>
          `${i + 1}. ${c.name}: ${formatMoney(c.balance)}${
            c.invoice_count ? ` (${c.invoice_count} invoices)` : ""
          }`,
      );
      return `Who owes the most:\n${lines.join("\n")}`;
    }
    case "aging_buckets": {
      const lines = [
        `Current: ${formatMoney(data.current)}`,
        `1-30 days: ${formatMoney(data.days_1_30)}`,
        `31-60 days: ${formatMoney(data.days_31_60)}`,
        `61-90 days: ${formatMoney(data.days_61_90)}`,
        `90+ days: ${formatMoney(data.days_90_plus)}`,
        `Grand total: ${formatMoney(data.total_receivable ?? data.grand_total)}`,
      ];
      return `Aging buckets:\n${lines.join("\n")}`;
    }
    default:
      return null;
  }
}

function answerFromProfileData(
  intent: QueryIntent,
  data: Record<string, unknown>,
): string | null {
  if (isQuickBooksARProfile(data)) {
    const qb = answerQuickBooksAR(intent, data);
    if (qb) return qb;
  }

  switch (intent) {
    case "payroll_total": {
      const totalPayroll = readField(data, "total_payroll");
      if (totalPayroll == null) {
        return "No hay monto de nómina en el archivo cargado (solo horas/propinas).";
      }
      return `Total de nómina: ${formatMoney(totalPayroll)}.`;
    }
    case "employee_count":
      return formatCount(readField(data, "employee_count"), "Empleados");
    case "most_hours_worked": {
      const employees = readPayrollEmployees(data);
      if (!employees.length) return null;
      const ranked = [...employees].sort(
        (a, b) => (b.total_hours ?? 0) - (a.total_hours ?? 0),
      );
      const top = ranked[0];
      if (!top?.total_hours) {
        return "No hay horas registradas por empleado en este archivo.";
      }
      const lines = ranked
        .slice(0, 5)
        .map(
          (employee, index) =>
            `${index + 1}. ${employee.name}: ${employee.total_hours?.toLocaleString("en-US") ?? 0} horas`,
        );
      return `Quién trabajó más horas:\n${lines.join("\n")}`;
    }
    case "total_hours":
      return formatCount(readField(data, "total_hours"), "Horas totales");
    case "overtime_hours":
      return formatCount(readField(data, "overtime_hours"), "Horas extra");
    case "total_tips":
      return `Propinas: ${formatMoney(readField(data, "total_tips"))}.`;
    case "receivable_total":
      return `El total pendiente por cobrar es ${formatMoney(readField(data, "total_receivable"))}.`;
    case "customer_count":
      return formatCount(readField(data, "customer_count"), "Clientes");
    case "invoice_count_receivable":
      return formatCount(readField(data, "invoice_count"), "Facturas");
    case "top_debtors":
    case "aging_buckets":
      return null;
    case "payable_total":
      return `Total por pagar: ${formatMoney(readField(data, "total_payable"))}.`;
    case "vendor_count":
      return formatCount(readField(data, "vendor_count"), "Proveedores");
    case "invoice_count_payable":
      return formatCount(readField(data, "invoice_count"), "Facturas");
    case "revenue":
      return `Ingresos: ${formatMoney(readField(data, "revenue"))}.`;
    case "expenses":
      return `Gastos: ${formatMoney(readField(data, "expenses"))}.`;
    case "net_income":
      return `Utilidad neta: ${formatMoney(readField(data, "net_income"))}.`;
    case "assets":
      return `Activos: ${formatMoney(readField(data, "assets"))}.`;
    case "liabilities":
      return `Pasivos: ${formatMoney(readField(data, "liabilities"))}.`;
    case "equity":
      return `Patrimonio: ${formatMoney(readField(data, "equity"))}.`;
    case "bank_difference":
      return `Diferencia de conciliación: ${formatMoney(readField(data, "difference"))}.`;
    case "closing_balance":
      return `Saldo final: ${formatMoney(readField(data, "closing_balance"))}.`;
    default:
      return null;
  }
}

function compareReceivableProfiles(
  current: QuickBooksARProfile,
  previous: QuickBooksARProfile,
  meta: {
    currentTitle: string;
    previousTitle: string;
    currentPeriod: string | null;
    previousPeriod: string | null;
  },
): string {
  const curTotal = current.total_receivable ?? current.grand_total ?? 0;
  const prevTotal = previous.total_receivable ?? previous.grand_total ?? 0;
  const diff = Number((curTotal - prevTotal).toFixed(2));

  const curMap = new Map(
    (current.customers ?? []).map((c) => [c.name.toLowerCase(), c]),
  );
  const prevMap = new Map(
    (previous.customers ?? []).map((c) => [c.name.toLowerCase(), c]),
  );

  const newCustomers: string[] = [];
  const removedCustomers: string[] = [];
  const changes: Array<{ name: string; change: number }> = [];

  for (const [key, cur] of curMap) {
    const prev = prevMap.get(key);
    if (!prev) {
      newCustomers.push(cur.name);
    } else {
      const change = Number((cur.balance - prev.balance).toFixed(2));
      if (change !== 0) changes.push({ name: cur.name, change });
    }
  }
  for (const [key, prev] of prevMap) {
    if (!curMap.has(key)) removedCustomers.push(prev.name);
  }

  changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const largestIncrease = changes.find((c) => c.change > 0) ?? null;
  const largestDecrease = changes.find((c) => c.change < 0) ?? null;

  const lines = [
    `Receivable comparison: «${meta.previousTitle}» (${meta.previousPeriod ?? "n/a"}) → «${meta.currentTitle}» (${meta.currentPeriod ?? "n/a"})`,
    `Difference in total: ${formatMoney(diff)} (${formatMoney(prevTotal)} → ${formatMoney(curTotal)})`,
    `New customers: ${newCustomers.length ? newCustomers.slice(0, 10).join(", ") : "none"}`,
    `Removed customers: ${removedCustomers.length ? removedCustomers.slice(0, 10).join(", ") : "none"}`,
    largestIncrease
      ? `Largest increase: ${largestIncrease.name} (${formatMoney(largestIncrease.change)})`
      : "Largest increase: none",
    largestDecrease
      ? `Largest decrease: ${largestDecrease.name} (${formatMoney(largestDecrease.change)})`
      : "Largest decrease: none",
  ];

  if (changes.length) {
    lines.push("Balance changes:");
    for (const c of changes.slice(0, 8)) {
      lines.push(`• ${c.name}: ${formatMoney(c.change)}`);
    }
  }

  return lines.join("\n");
}

export async function answerFromStructuredQuery(params: {
  question: string;
  companyId: string;
  reportId?: string | null;
  period?: string | null;
}): Promise<StructuredAnswer> {
  const intent = detectQueryIntent(params.question);

  const tresbePayroll = await answerFromTresbePayroll(params, intent);
  if (tresbePayroll) return tresbePayroll;

  if (requiresOpenAI(intent)) {
    if (intent === "summary") {
      const profiles = await getProfilesForCompany(params.companyId, {
        reportId: params.reportId,
        period: params.period,
      });
      const arPreferred =
        /cuentas?\s*por\s*cobrar|receivable|cobrar|aging|balance\s*detail/i.test(
          params.question,
        );
      const payrollPreferred =
        (/n[oó]mina|payroll/i.test(params.question) ||
          profiles.some((p) => p.document_type === "payroll")) &&
        !arPreferred;

      if (arPreferred) {
        const arProfile = profiles.find(
          (profile) =>
            profile.document_type === "accounts_receivable" &&
            isQuickBooksARProfile(
              (profile.structured_data ?? {}) as Record<string, unknown>,
            ),
        );
        if (arProfile && (arProfile.extraction_confidence ?? 0) >= 0.35) {
          const message = buildQuickBooksARAnalyticalSummary(
            arProfile.structured_data as unknown as QuickBooksARProfile,
          );
          return {
            answered: true,
            message,
            sources: profileSources(profiles),
            intent,
          };
        }
      }

      const latest = payrollPreferred
        ? (profiles.find((p) => p.document_type === "payroll") ?? profiles[0])
        : (profiles.find((p) => p.document_type === "accounts_receivable") ??
          profiles[0]);
      if (latest?.summary && (latest.extraction_confidence ?? 0) >= 0.35) {
        return {
          answered: true,
          message: latest.summary,
          sources: profileSources(profiles),
          intent,
        };
      }
    }
    return { answered: false, message: "", sources: [], intent };
  }

  if (intent === "comparison") {
    const profiles = await getProfilesForCompany(params.companyId, {
      reportId: params.reportId,
      documentType: "accounts_receivable",
    });

    const arProfiles = profiles.filter((p) =>
      isQuickBooksARProfile(
        (p.structured_data ?? {}) as Record<string, unknown>,
      ),
    );

    if (arProfiles.length >= 2) {
      const current = arProfiles[0];
      const previous = arProfiles[1];
      const message = compareReceivableProfiles(
        current.structured_data as unknown as QuickBooksARProfile,
        previous.structured_data as unknown as QuickBooksARProfile,
        {
          currentTitle:
            (
              current.document_processing as {
                reports?: { title?: string };
              } | null
            )?.reports?.title ?? "Current AR report",
          previousTitle:
            (
              previous.document_processing as {
                reports?: { title?: string };
              } | null
            )?.reports?.title ?? "Previous AR report",
          currentPeriod: current.period,
          previousPeriod: previous.period,
        },
      );

      return {
        answered: true,
        message,
        sources: profileSources([current, previous]),
        intent,
      };
    }

    const comparison = await compareLatestDocuments({
      companyId: params.companyId,
      currentReportId: params.reportId,
      documentType: "accounts_receivable",
    });

    if (!comparison.available) {
      const fallback = await compareLatestDocuments({
        companyId: params.companyId,
        currentReportId: params.reportId,
      });
      if (!fallback.available) {
        return {
          answered: true,
          message:
            fallback.message ?? "No hay suficientes documentos para comparar.",
          sources: [],
          intent,
        };
      }
      return {
        answered: true,
        message: [
          `Comparación entre «${fallback.previous.title}» (${fallback.previous.period ?? "sin periodo"}) y «${fallback.current.title}» (${fallback.current.period ?? "sin periodo"}):`,
          ...fallback.highlights,
        ].join("\n"),
        sources: [
          {
            reportId: fallback.current.reportId,
            title: fallback.current.title,
            period: fallback.current.period,
          },
          {
            reportId: fallback.previous.reportId,
            title: fallback.previous.title,
            period: fallback.previous.period,
          },
        ],
        intent,
      };
    }

    return {
      answered: true,
      message: [
        `Comparación entre «${comparison.previous.title}» (${comparison.previous.period ?? "sin periodo"}) y «${comparison.current.title}» (${comparison.current.period ?? "sin periodo"}):`,
        ...comparison.highlights,
      ].join("\n"),
      sources: [
        {
          reportId: comparison.current.reportId,
          title: comparison.current.title,
          period: comparison.current.period,
        },
        {
          reportId: comparison.previous.reportId,
          title: comparison.previous.title,
          period: comparison.previous.period,
        },
      ],
      intent,
    };
  }

  if (intent === "unknown") {
    return { answered: false, message: "", sources: [], intent };
  }

  const profiles = await getProfilesForCompany(params.companyId, {
    reportId: params.reportId,
    period: params.period,
  });

  if (!profiles.length) {
    return { answered: false, message: "", sources: [], intent };
  }

  // Prefer specialized profiles for domain-specific intents
  const payrollIntents = new Set([
    "payroll_total",
    "employee_count",
    "most_hours_worked",
    "total_hours",
    "overtime_hours",
    "total_tips",
    "service_checks_total",
    "service_check_recipients",
  ]);
  const receivableIntents = new Set([
    "receivable_total",
    "customer_count",
    "invoice_count_receivable",
    "top_debtors",
    "aging_buckets",
  ]);

  const preferred = payrollIntents.has(intent)
    ? (profiles.find((p) => p.document_type === "payroll") ?? profiles[0])
    : receivableIntents.has(intent)
      ? (profiles.find((p) => p.document_type === "accounts_receivable") ??
        profiles[0])
      : profiles[0];

  const data = (preferred.structured_data ?? {}) as Record<string, unknown>;
  const answer = answerFromProfileData(intent, data);

  if (!answer) {
    return { answered: false, message: "", sources: [], intent };
  }

  const periodNote = preferred.period ? ` (${preferred.period})` : "";
  const sourcesAppendix = profileSources([preferred])
    .map((s) => `• ${s.title}${s.period ? ` · ${s.period}` : ""}`)
    .join("\n");

  return {
    answered: true,
    message: `${answer}\n\nSources\n${sourcesAppendix || `• Documento analizado${periodNote}`}`,
    sources: profileSources([preferred]),
    intent,
  };
}

export type { QuickBooksARCustomer };
