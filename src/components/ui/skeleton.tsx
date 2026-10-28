import { cn } from "@/lib/utils";

/** Bloque gris pulsante para estados de carga. Decorativo (oculto a lectores). */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}
