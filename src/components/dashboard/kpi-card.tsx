import Link from "next/link";

import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: number;
  hint: string;
  href: string;
  /** "attention" resalta el valor cuando es mayor que cero. */
  tone?: "attention" | "neutral";
};

export function KpiCard({
  label,
  value,
  hint,
  href,
  tone = "attention",
}: KpiCardProps) {
  const highlighted = tone === "attention" && value > 0;
  return (
    <Link
      href={href}
      className="border-border/80 bg-card hover:border-primary/40 focus-visible:ring-ring block rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
          highlighted ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
    </Link>
  );
}
