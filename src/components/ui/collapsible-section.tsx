import type { ReactNode } from "react";

/** Acordeón simple sin JS (details/summary), colapsado por defecto. */
export function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-lg font-semibold">
        {icon}
        {title}
        <span className="text-muted-foreground ml-1 text-sm transition-transform group-open:rotate-90">
          ▸
        </span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
