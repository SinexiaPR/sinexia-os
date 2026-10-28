import assert from "node:assert/strict";

import { summarizeAdminHome } from "../src/lib/admin-client-dashboard/home";
import type {
  ClientDashboardCard,
  DashboardActionType,
  DashboardItemState,
} from "../src/types/admin-client-dashboard";

function card(
  name: string,
  items: [DashboardActionType, DashboardItemState][],
): ClientDashboardCard {
  return {
    company: { id: name, name, slug: name.toLowerCase() },
    semaphore: items.some(([, s]) => s !== "done") ? "amber" : "green",
    items: items.map(([actionType, state], i) => ({
      id: `${name}-${i}`,
      key: `${actionType}-${i}`,
      actionType,
      label: actionType,
      state,
      stateLabel: state,
      lastUpdated: null,
      href: "/",
      manual: actionType === "manual",
    })),
  };
}

const summary = summarizeAdminHome([
  card("Sibarita", [
    ["weekly_payroll", "done"],
    ["invoice_weekly", "done"],
  ]),
  card("Magol", [["invoice_weekly", "in_progress"]]),
  card("Tresbe", [
    ["tresbe_payroll", "in_progress"],
    ["tresbe_budget", "pending"],
    ["invoice_weekly", "pending"],
    ["leave_accrual", "done"],
  ]),
  card("Cut", [["manual", "pending"]]),
  card("Baldonny", []),
]);

assert.deepEqual(
  summary.attention.map((e) => e.card.company.name),
  ["Tresbe", "Cut", "Magol"],
  "más pendientes primero; a igualdad, más en proceso; luego nombre",
);
assert.deepEqual(
  summary.upToDate.map((c) => c.company.name),
  ["Baldonny", "Sibarita"],
  "al día en orden alfabético, incluyendo clientes sin tareas",
);
assert.equal(summary.clientsWithPending, 3);
assert.equal(summary.payrollsToApprove, 1, "solo nóminas en proceso");

const tresbe = summary.attention[0];
assert.deepEqual(
  tresbe.openItems.map((i) => i.state),
  ["pending", "pending", "in_progress"],
  "dentro de un cliente, pendientes antes que en proceso",
);
assert.equal(tresbe.pendingCount, 2);
assert.equal(tresbe.inProgressCount, 1);

const empty = summarizeAdminHome([]);
assert.equal(empty.attention.length, 0);
assert.equal(empty.upToDate.length, 0);
assert.equal(empty.payrollsToApprove, 0);

console.log("Admin home summary: PASS");
