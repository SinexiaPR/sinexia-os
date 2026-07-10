"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";

import { deleteReport } from "@/actions/reports";
import { Button } from "@/components/ui/button";

type DeleteReportButtonProps = {
  reportId: string;
};

export function DeleteReportButton({ reportId }: DeleteReportButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={isPending}
      className="size-9 shrink-0"
      onClick={() =>
        startTransition(async () => {
          await deleteReport(reportId);
        })
      }
    >
      <Trash2 className="size-4" />
      <span className="sr-only">Delete report</span>
    </Button>
  );
}
