"use client";

import type { ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Panel de filtros: popover en escritorio y hoja inferior en móvil.
 * `trigger` es el botón (se pasa con `asChild` internamente).
 */
export function FilterPanel({
  trigger,
  title = "Filtros",
  children,
  align = "start",
  className,
}: {
  trigger: ReactNode;
  title?: string;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85svh] gap-0 overflow-y-auto rounded-t-xl p-0"
        >
          <SheetHeader className="border-border/70 border-b px-5 py-4 pr-12">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="sr-only">
              Ajusta los filtros de la lista
            </SheetDescription>
          </SheetHeader>
          <div className={cn("space-y-3 px-5 py-4", className)}>{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className={cn("w-80 space-y-3", className)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
