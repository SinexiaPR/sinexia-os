import { cn } from "@/lib/utils";

type DocumentViewedIndicatorProps = {
  isViewed: boolean;
  className?: string;
};

export function DocumentViewedIndicator({
  isViewed,
  className,
}: DocumentViewedIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        isViewed ? "text-muted-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {!isViewed ? (
        <span className="size-1.5 shrink-0 rounded-full bg-red-500/90" aria-hidden />
      ) : null}
      <span>{isViewed ? "Visto" : "No visto"}</span>
    </span>
  );
}
