import * as React from "react";

import { cn } from "@/lib/utils";

export type TableDensity = "comfortable" | "compact";

/**
 * Tabla con encabezado fijo y dos densidades. El contenedor hace scroll
 * horizontal controlado; pasa `maxHeight` para limitar la altura y fijar el
 * encabezado al desplazarse.
 */
function Table({
  className,
  density = "comfortable",
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & {
  density?: TableDensity;
  containerClassName?: string;
}) {
  return (
    <div
      data-slot="table-container"
      className={cn("w-full overflow-auto", containerClassName)}
    >
      <table
        data-slot="table"
        data-density={density}
        className={cn("group/table w-full text-left text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-card text-muted-foreground sticky top-0 z-10 text-xs [&_tr]:border-b",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("hover:bg-muted/40 border-b transition-colors", className)}
      {...props}
    />
  );
}

function TableHead({
  className,
  numeric,
  ...props
}: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn(
        "px-2 py-2.5 font-medium whitespace-nowrap",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

/** `numeric` alinea a la derecha y usa cifras tabulares (importes, horas). */
function TableCell({
  className,
  numeric,
  ...props
}: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-2 py-2.5 group-data-[density=compact]/table:py-1.5",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
