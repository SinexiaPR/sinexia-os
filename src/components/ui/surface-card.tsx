import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
  id?: string;
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
  id,
  padding = "md",
}: SurfaceCardProps) {
  return (
    <div
      id={id}
      className={cn(
        "border-border/80 bg-card rounded-lg border",
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
    <SurfaceCard
      className={cn("flex flex-col justify-between p-4", className)}
      padding="lg"
    >
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="mt-3">
        <p className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {hint ? (
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            {hint}
          </p>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
