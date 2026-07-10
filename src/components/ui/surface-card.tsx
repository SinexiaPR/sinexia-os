import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
};

const paddingMap = {
  sm: "p-5",
  md: "p-6",
  lg: "p-8",
};

export function SurfaceCard({
  children,
  className,
  padding = "md",
}: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        paddingMap[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}

type MetricCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
};

export function MetricCard({ label, value, hint, className }: MetricCardProps) {
  return (
    <SurfaceCard className={cn("flex flex-col justify-between", className)} padding="lg">
      <p className="text-[13px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-6">
        <p className="text-4xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        {hint ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
