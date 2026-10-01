export type DashboardActionType =
  | "tresbe_payroll"
  | "weekly_payroll"
  | "invoice_weekly"
  | "tresbe_budget"
  | "leave_accrual"
  | "manual";

export type DashboardItemState = "done" | "in_progress" | "pending";

export type DashboardConfigItem = {
  id: string;
  companyId: string;
  key: string;
  label: string;
  actionType: DashboardActionType;
  frequency: "weekly" | "monthly" | "ongoing";
  href: string;
  sortOrder: number;
  manualStatus: DashboardItemState | null;
  manualStatusLabel: string | null;
  manualStatusUpdatedAt: string | null;
};

export type DashboardItem = {
  id: string;
  key: string;
  label: string;
  state: DashboardItemState;
  stateLabel: string;
  lastUpdated: string | null;
  href: string;
  manual: boolean;
};

export type ClientDashboardCard = {
  company: { id: string; name: string; slug: string };
  semaphore: "green" | "amber" | "red";
  items: DashboardItem[];
};
