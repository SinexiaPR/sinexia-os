"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useState } from "react";

import { AdminReportForm } from "@/components/reports/admin-report-form";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Company } from "@/types";

/** Botón "Publicar reporte" que abre el formulario en un panel lateral. */
export function PublishReportDrawer({
  companies,
  initialCompanyId,
  defaultOpen = false,
}: {
  companies: Company[];
  initialCompanyId?: string;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="h-10">
          <Plus className="size-4" />
          Publicar reporte
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-border/70 border-b px-6 py-4 pr-12">
          <SheetTitle>Publicar reporte</SheetTitle>
          <SheetDescription>
            Elige la empresa, agrega los datos y sube el PDF, Excel o CSV
            terminado. SinexIA procesa el archivo automáticamente.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 py-5">
          <AdminReportForm
            companies={companies}
            initialCompanyId={initialCompanyId}
            onPublished={() => {
              router.refresh();
              setOpen(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
