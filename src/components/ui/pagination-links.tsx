import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { Page } from "@/lib/pagination";

/** Paginación por enlaces (servidor): cada página es una URL compartible. */
export function PaginationLinks({
  view,
  hrefForPage,
}: {
  view: Pick<Page<unknown>, "from" | "to" | "total" | "page" | "totalPages">;
  hrefForPage: (page: number) => string;
}) {
  if (view.totalPages <= 1) return null;
  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-3 pt-2"
    >
      <p className="text-muted-foreground text-sm">
        Mostrando {view.from}–{view.to} de {view.total}
      </p>
      <div className="flex items-center gap-2">
        {view.page > 1 ? (
          <Link
            href={hrefForPage(view.page - 1)}
            className={
              buttonVariants({ variant: "outline", size: "sm" }) + " h-10"
            }
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Link>
        ) : null}
        <span className="text-muted-foreground text-sm tabular-nums">
          {view.page} / {view.totalPages}
        </span>
        {view.page < view.totalPages ? (
          <Link
            href={hrefForPage(view.page + 1)}
            className={
              buttonVariants({ variant: "outline", size: "sm" }) + " h-10"
            }
          >
            Siguiente
            <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
