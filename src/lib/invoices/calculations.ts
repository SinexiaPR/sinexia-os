import type { InvoiceDiscountType } from "@/types/invoices";

export type InvoiceCalculationItem = {
  quantity: number;
  unitPrice: number;
};

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateInvoiceTotals(params: {
  items: InvoiceCalculationItem[];
  discountType: InvoiceDiscountType;
  discountValue: number;
  taxRate: number;
}) {
  const lineAmounts = params.items.map((item) =>
    roundMoney(item.quantity * item.unitPrice),
  );
  const subtotal = roundMoney(
    lineAmounts.reduce((sum, amount) => sum + amount, 0),
  );
  const requestedDiscount =
    params.discountType === "fixed"
      ? roundMoney(params.discountValue)
      : params.discountType === "percentage"
        ? roundMoney((subtotal * params.discountValue) / 100)
        : 0;
  const discountAmount = Math.min(subtotal, requestedDiscount);
  const taxableSubtotal = roundMoney(Math.max(subtotal - discountAmount, 0));
  const taxAmount = roundMoney((taxableSubtotal * params.taxRate) / 100);
  const total = roundMoney(taxableSubtotal + taxAmount);
  return {
    lineAmounts,
    subtotal,
    discountAmount,
    taxableSubtotal,
    taxAmount,
    total,
  };
}
