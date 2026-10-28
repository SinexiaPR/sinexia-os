import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Clock3,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Users,
} from "lucide-react";

export const REPORT_CATEGORIES = [
  "Aging",
  "Profit & Loss",
  "Balance Sheet",
  "Bank Reconciliation",
  "Payroll",
  "Statement",
  "Custom Report",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export type ReportCategoryMeta = {
  label: string;
  clientLabel: string;
  adminOptionLabel: string;
  icon: LucideIcon;
};

export const REPORT_CATEGORY_META: Record<ReportCategory, ReportCategoryMeta> =
  {
    Aging: {
      label: "Antigüedad de saldos",
      clientLabel: "Antigüedad de saldos",
      adminOptionLabel: "Antigüedad de saldos",
      icon: Clock3,
    },
    "Profit & Loss": {
      label: "Estado de resultados",
      clientLabel: "Estado de resultados",
      adminOptionLabel: "Estado de resultados",
      icon: TrendingUp,
    },
    "Balance Sheet": {
      label: "Balance general",
      clientLabel: "Balance general",
      adminOptionLabel: "Balance general",
      icon: FileSpreadsheet,
    },
    "Bank Reconciliation": {
      label: "Conciliación Bancaria",
      clientLabel: "Conciliación Bancaria",
      adminOptionLabel: "Conciliación Bancaria",
      icon: ArrowLeftRight,
    },
    Payroll: {
      label: "Nómina",
      clientLabel: "Nómina",
      adminOptionLabel: "Nómina",
      icon: Users,
    },
    Statement: {
      label: "Estado de cuenta",
      clientLabel: "Estado de cuenta",
      adminOptionLabel: "Estado de cuenta",
      icon: FileText,
    },
    "Custom Report": {
      label: "Reporte personalizado",
      clientLabel: "Reporte personalizado",
      adminOptionLabel: "Reporte personalizado",
      icon: FileBarChart2,
    },
  };

const LEGACY_CATEGORY_ALIASES: Record<string, ReportCategory> = {
  "Bank Statement": "Statement",
};

export function isReportCategory(value: string): value is ReportCategory {
  return REPORT_CATEGORIES.includes(value as ReportCategory);
}

export function resolveReportCategory(value: string): ReportCategory | null {
  if (isReportCategory(value)) {
    return value;
  }

  return LEGACY_CATEGORY_ALIASES[value] ?? null;
}

export function getReportCategoryMeta(
  value: string,
): ReportCategoryMeta | null {
  const category = resolveReportCategory(value);

  if (!category) {
    return null;
  }

  return REPORT_CATEGORY_META[category];
}

export const REPORTS_BUCKET = "reports" as const;

export const REPORTS_MAX_BYTES = 50 * 1024 * 1024;

export const REPORTS_ACCEPT =
  "application/pdf,.doc,.docx,.xls,.xlsx,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";
