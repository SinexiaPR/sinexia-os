import { compareLatestDocuments } from "@/lib/intelligence/comparison";
import {
  detectQueryIntent,
  requiresOpenAI,
  type QueryIntent,
} from "@/lib/intelligence/intents";
import { getProfilesForCompany } from "@/lib/intelligence/profiles/store";
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

function answerFromProfileData(
  intent: QueryIntent,
  data: Record<string, unknown>,
): string | null {
  switch (intent) {
    case "payroll_total":
      return `Total de nómina: ${formatMoney(readField(data, "total_payroll"))}.`;
    case "employee_count":
      return formatCount(readField(data, "employee_count"), "Empleados");
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
      const latest = profiles[0];
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
    const comparison = await compareLatestDocuments({
      companyId: params.companyId,
      currentReportId: params.reportId,
    });

    if (!comparison.available) {
      return {
        answered: true,
        message: comparison.message ?? "No hay suficientes documentos para comparar.",
        sources: [],
        intent,
      };
    }

    const lines = [
      `Comparación entre «${comparison.previous.title}» (${comparison.previous.period ?? "sin periodo"}) y «${comparison.current.title}» (${comparison.current.period ?? "sin periodo"}):`,
      ...comparison.highlights,
    ];

    return {
      answered: true,
      message: lines.join("\n"),
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

  const latest = profiles[0];
  const data = (latest.structured_data ?? {}) as Record<string, unknown>;
  const answer = answerFromProfileData(intent, data);

  if (!answer) {
    return { answered: false, message: "", sources: [], intent };
  }

  const periodNote = latest.period ? ` (${latest.period})` : "";
  return {
    answered: true,
    message: `${answer}\n\nFuente: documento analizado${periodNote}.`,
    sources: profileSources(profiles),
    intent,
  };
}
