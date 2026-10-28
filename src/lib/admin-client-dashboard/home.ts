import type {
  ClientDashboardCard,
  DashboardActionType,
  DashboardItem,
} from "@/types/admin-client-dashboard";

const PAYROLL_ACTIONS: DashboardActionType[] = [
  "tresbe_payroll",
  "weekly_payroll",
];

export type AttentionEntry = {
  card: ClientDashboardCard;
  /** Ítems que requieren acción (pendientes primero, luego en proceso). */
  openItems: DashboardItem[];
  pendingCount: number;
  inProgressCount: number;
};

export type AdminHomeSummary = {
  /** Clientes con algo por hacer, del más urgente al menos urgente. */
  attention: AttentionEntry[];
  /** Clientes sin pendientes, por orden alfabético. */
  upToDate: ClientDashboardCard[];
  clientsWithPending: number;
  /** Nóminas ya cargadas que esperan aprobación o envío (en proceso). */
  payrollsToApprove: number;
};

const stateWeight = { pending: 0, in_progress: 1, done: 2 } as const;

/**
 * Ordena los clientes por urgencia: más ítems pendientes primero, luego más en
 * proceso, luego nombre. Los clientes sin pendientes van aparte.
 */
export function summarizeAdminHome(
  cards: ClientDashboardCard[],
): AdminHomeSummary {
  const attention: AttentionEntry[] = [];
  const upToDate: ClientDashboardCard[] = [];
  let payrollsToApprove = 0;

  for (const card of cards) {
    const openItems = card.items
      .filter((item) => item.state !== "done")
      .sort((a, b) => stateWeight[a.state] - stateWeight[b.state]);

    for (const item of card.items) {
      if (
        item.state === "in_progress" &&
        PAYROLL_ACTIONS.includes(item.actionType)
      ) {
        payrollsToApprove += 1;
      }
    }

    if (!openItems.length) {
      upToDate.push(card);
      continue;
    }
    attention.push({
      card,
      openItems,
      pendingCount: openItems.filter((i) => i.state === "pending").length,
      inProgressCount: openItems.filter((i) => i.state === "in_progress")
        .length,
    });
  }

  attention.sort(
    (a, b) =>
      b.pendingCount - a.pendingCount ||
      b.inProgressCount - a.inProgressCount ||
      a.card.company.name.localeCompare(b.card.company.name, "es"),
  );
  upToDate.sort((a, b) => a.company.name.localeCompare(b.company.name, "es"));

  return {
    attention,
    upToDate,
    clientsWithPending: attention.length,
    payrollsToApprove,
  };
}
