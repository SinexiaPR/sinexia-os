"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { markInvoiceViewed } from "@/actions/invoices";

export function InvoiceViewTracker({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const trackedInvoice = useRef<string | null>(null);

  useEffect(() => {
    if (trackedInvoice.current === invoiceId) return;
    trackedInvoice.current = invoiceId;
    void markInvoiceViewed(invoiceId).then((result) => {
      if (result?.success) router.refresh();
    });
  }, [invoiceId, router]);
  return null;
}
