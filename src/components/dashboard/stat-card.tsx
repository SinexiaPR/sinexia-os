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
        "border-border bg-card rounded-lg border p-6 shadow-sm",
        className,
      )}
    >
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      <p className="text-foreground mt-3 text-4xl font-semibold tracking-tight">
        {value}
      </p>
      {hint ? (
        <p className="text-muted-foreground mt-2 text-sm">{hint}</p>
      ) : null}
    </div>
  );
}
