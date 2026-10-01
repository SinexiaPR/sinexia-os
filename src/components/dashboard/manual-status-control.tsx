"use client";

import { useTransition } from "react";

import { setManualDashboardItemStatus } from "@/actions/admin-client-dashboard";
import type {
  DashboardItem,
  DashboardItemState,
} from "@/types/admin-client-dashboard";

const options: { value: DashboardItemState; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En proceso" },
  { value: "done", label: "Hecho" },
];

export function ManualStatusControl({ item }: { item: DashboardItem }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label={`Estado manual de ${item.label}`}
      className="h-8 shrink-0 rounded-md border border-input bg-background px-2 text-xs"
      value={item.state}
      disabled={pending}
      onChange={(event) => {
        const status = event.target.value as DashboardItemState;
        startTransition(async () => {
          await setManualDashboardItemStatus(item.id, status);
        });
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
