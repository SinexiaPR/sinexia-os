import { getReportCategoryMeta } from "@/lib/constants/reports";
import { cn } from "@/lib/utils";

type ReportCategoryDisplayProps = {
  category: string;
  variant?: "client" | "admin";
  className?: string;
};

export function ReportCategoryDisplay({
  category,
  variant = "client",
  className,
}: ReportCategoryDisplayProps) {
  const meta = getReportCategoryMeta(category);
  const label =
    variant === "client"
      ? (meta?.clientLabel ?? category)
      : (meta?.label ?? category);
  const Icon = meta?.icon;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {Icon ? (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </div>
      ) : null}
      <p className="text-[13px] font-medium tracking-wide text-primary uppercase">
        {label}
      </p>
    </div>
  );
}
