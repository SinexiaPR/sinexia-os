import { cn } from "@/lib/utils";

/** Marca de Sinexia (cuadrado con la inicial). Decorativa: el nombre va al lado. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-primary text-primary-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
        className,
      )}
    >
      S
    </span>
  );
}
