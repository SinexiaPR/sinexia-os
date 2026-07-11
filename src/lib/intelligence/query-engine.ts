import { compareLatestDocuments } from "@/lib/intelligence/comparison";
import {
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
import type { PayrollEmployeeSummary } from "@/lib/intelligence/profiles/types";
import type { SourceReference } from "@/lib/intelligence/types";

type StructuredAnswer = {
  answered: boolean;
  message: string;
  sources: SourceReference[];
  intent: QueryIntent;
};

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

function readField(
  data: Record<string, unknown>,
  key: string,
): number | null {
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
      return `Total receivable: ${formatMoney(data.total_receivable ?? data.grand_total)}.`;
    case "customer_count":
      return formatCount(data.customer_count ?? customers.length, "Customers");
    case "invoice_count_receivable":
      return formatCount(data.invoice_count, "Invoices");
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
    case "overtime_hours":
      return formatCount(readField(data, "overtime_hours"), "Horas extra");
    case "total_tips":
      return `Propinas: ${formatMoney(readField(data, "total_tips"))}.`;
    case "receivable_total":
      return `Total por cobrar: ${formatMoney(readField(data, "total_receivable"))}.`;
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

  if (requiresOpenAI(intent)) {
    if (intent === "summary") {
      const profiles = await getProfilesForCompany(params.companyId, {
        reportId: params.reportId,
        period: params.period,
      });
      const preferred =
        profiles.find((p) => p.document_type === "payroll") ?? profiles[0];
      const latest = preferred;
      if (
        latest?.summary &&
        (latest.extraction_confidence ?? 0) >= 0.35
      ) {
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
            fallback.message ??
            "No hay suficientes documentos para comparar.",
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
    "overtime_hours",
    "total_tips",
  ]);
  const receivableIntents = new Set([
    "receivable_total",
    "customer_count",
    "invoice_count_receivable",
    "top_debtors",
    "aging_buckets",
  ]);

  const preferred = payrollIntents.has(intent)
    ? profiles.find((p) => p.document_type === "payroll") ?? profiles[0]
    : receivableIntents.has(intent)
      ? profiles.find((p) => p.document_type === "accounts_receivable") ??
        profiles[0]
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
