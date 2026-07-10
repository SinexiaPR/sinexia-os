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

export const REPORT_CATEGORY_META: Record<ReportCategory, ReportCategoryMeta> = {
  Aging: {
    label: "Aging",
    clientLabel: "Antigüedad de saldos",
    adminOptionLabel: "Aging",
    icon: Clock3,
  },
  "Profit & Loss": {
    label: "Profit & Loss",
    clientLabel: "Estado de resultados",
    adminOptionLabel: "Profit & Loss",
    icon: TrendingUp,
  },
  "Balance Sheet": {
    label: "Balance Sheet",
    clientLabel: "Balance general",
    adminOptionLabel: "Balance Sheet",
    icon: FileSpreadsheet,
  },
  "Bank Reconciliation": {
    label: "Bank Reconciliation",
    clientLabel: "Conciliación Bancaria",
    adminOptionLabel: "Bank Reconciliation (Conciliación Bancaria)",
    icon: ArrowLeftRight,
  },
  Payroll: {
    label: "Payroll",
    clientLabel: "Nómina",
    adminOptionLabel: "Payroll",
    icon: Users,
  },
  Statement: {
    label: "Statement",
    clientLabel: "Estado de cuenta",
    adminOptionLabel: "Statement",
    icon: FileText,
  },
  "Custom Report": {
    label: "Custom Report",
    clientLabel: "Reporte personalizado",
    adminOptionLabel: "Custom Report",
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

export function getReportCategoryMeta(value: string): ReportCategoryMeta | null {
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
