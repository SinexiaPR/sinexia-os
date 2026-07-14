import { SurfaceCard } from "@/components/ui/surface-card";
import type { BillingSettings, Invoice, InvoiceItem } from "@/types/invoices";

export function InvoicePreview({
  invoice,
  items,
  settings,
}: {
  invoice: Invoice;
  items: InvoiceItem[];
  settings: BillingSettings | null;
}) {
  const money = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: invoice.currency,
    }).format(Number(value));
  return (
    <SurfaceCard className="mx-auto max-w-4xl overflow-hidden p-0">
      <div className="border-b-4 border-blue-700 bg-slate-950 px-8 py-7 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-2xl font-semibold tracking-wide">
              {settings?.issuer_display_name ?? "Sinexia"}
            </p>
            <p className="mt-2 text-xs text-slate-300">
              {settings?.contact_email}
            </p>
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-semibold">FACTURA</h1>
            <p className="mt-2">#{invoice.invoice_number ?? "BORRADOR"}</p>
          </div>
        </div>
      </div>
      <div className="space-y-8 p-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase">
              Facturar a
            </p>
            <p className="mt-2 font-semibold">
              {invoice.billing_name_snapshot}
            </p>
            <p className="text-muted-foreground text-sm whitespace-pre-line">
              {invoice.billing_address_snapshot}
            </p>
            <p className="text-muted-foreground text-sm">
              {invoice.billing_email_snapshot}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{invoice.invoice_date ?? "—"}</dd>
            <dt className="text-muted-foreground">Vencimiento</dt>
            <dd>{invoice.due_date ?? "—"}</dd>
            <dt className="text-muted-foreground">Referencia</dt>
            <dd>{invoice.purchase_order_reference ?? "—"}</dd>
          </dl>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="p-3">Cantidad</th>
                <th>Descripción</th>
                <th>Precio</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="p-3">{item.quantity}</td>
                  <td>{item.description}</td>
                  <td>{money(item.unit_price)}</td>
                  <td className="font-medium">{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ml-auto max-w-sm space-y-2 text-sm">
          <Row label="Subtotal" value={money(invoice.subtotal)} />
          <Row label="Descuento" value={money(invoice.discount_amount)} />
          <Row label="Impuesto" value={money(invoice.tax_amount)} />
          <Row label="Total" value={money(invoice.total)} strong />
        </div>
        <div className="grid gap-6 border-t pt-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase">
              Método de pago
            </p>
            <p className="mt-2 text-sm">{settings?.payment_method_label}</p>
            <p className="text-sm">{settings?.bank_account_name}</p>
          </div>
          <p className="text-muted-foreground text-sm">
            {invoice.client_note ??
              settings?.default_footer ??
              "Gracias por su confianza."}
          </p>
        </div>
      </div>
    </SurfaceCard>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${strong ? "border-t pt-3 text-lg font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
