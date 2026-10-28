"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Page } from "@/lib/pagination";

/** Pie de paginación: "Mostrando 1–25 de N" y botones Anterior / Siguiente. */
export function PaginationBar({
  view,
  onPageChange,
  className,
}: {
  view: Pick<Page<unknown>, "from" | "to" | "total" | "page" | "totalPages">;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (view.total === 0) return null;
  return (
    <div
      className={
        className ??
        "border-border/70 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
      }
    >
      <p className="text-muted-foreground text-sm" aria-live="polite">
        Mostrando {view.from}–{view.to} de {view.total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-10"
          disabled={view.page <= 1}
          onClick={() => onPageChange(view.page - 1)}
        >
          <ChevronLeft className="size-4" />
          Anterior
        </Button>
        <span className="text-muted-foreground text-sm tabular-nums">
          {view.page} / {view.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-10"
          disabled={view.page >= view.totalPages}
          onClick={() => onPageChange(view.page + 1)}
        >
          Siguiente
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
