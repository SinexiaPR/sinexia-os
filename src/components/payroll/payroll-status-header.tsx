"use client";

import { Button } from "@/components/ui/button";

const money = new Intl.NumberFormat("es-US", {
  style: "currency",
  currency: "USD",
});

export type PayrollStatusHeaderProps = {
  weekLabel: string;
  statusLabel: string;
  total: number;
  tabs: { label: string; active: boolean; onSelect: () => void }[];
};

export function PayrollStatusHeader({
  weekLabel,
  statusLabel,
  total,
  tabs,
}: PayrollStatusHeaderProps) {
  return (
    <div className="border-border/80 bg-background/95 sticky top-14 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-medium">{weekLabel}</p>
        <p className="text-muted-foreground text-sm">{statusLabel}</p>
        <p className="text-sm font-semibold">{money.format(total)}</p>
      </div>
      <div className="bg-muted flex gap-1 rounded-lg p-1">
        {tabs.map((tab) => (
          <Button
            key={tab.label}
            size="sm"
            variant={tab.active ? "default" : "ghost"}
            onClick={tab.onSelect}
          >
            {tab.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
