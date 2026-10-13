"use client";

import { cn } from "@/lib/utils";

export type UnderlineTab = {
  label: string;
  active: boolean;
  onSelect: () => void;
};

export function UnderlineTabs({
  tabs,
  className,
}: {
  tabs: UnderlineTab[];
  className?: string;
}) {
  return (
    <nav className={cn("border-b", className)}>
      <ul className="-mb-px flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <li key={tab.label}>
            <button
              type="button"
              onClick={tab.onSelect}
              className={cn(
                "border-b-2 px-3 py-1.5 text-xs font-medium transition-colors",
                tab.active
                  ? "border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
