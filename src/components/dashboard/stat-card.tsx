import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
};

export function StatCard({ label, value, hint, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-6 shadow-sm",
        className,
      )}
    >
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
