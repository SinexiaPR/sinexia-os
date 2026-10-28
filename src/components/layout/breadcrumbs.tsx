import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  /** Sin `href` = página actual. */
  href?: string;
};

export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <nav aria-label="Ruta de navegación" className={className}>
      <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li className="min-w-0">
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    className={cn(
                      "hover:text-foreground focus-visible:ring-ring inline-flex min-h-6 items-center rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none",
                    )}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className={cn(
                      "block max-w-[16rem] truncate",
                      isLast && "text-foreground font-medium",
                    )}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast ? (
                <li aria-hidden className="flex items-center">
                  <ChevronRight className="size-3.5" />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
