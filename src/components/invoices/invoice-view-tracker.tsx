"use client";

import { useEffect } from "react";

import { markInvoiceViewed } from "@/actions/invoices";

export function InvoiceViewTracker({ invoiceId }: { invoiceId: string }) {
  useEffect(() => {
    void markInvoiceViewed(invoiceId);
  }, [invoiceId]);
  return null;
}
