"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { saveInvoiceDraft, type InvoiceDraftInput } from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import type {
  BillingCompany,
  BillingSettings,
  Invoice,
  InvoiceItem,
} from "@/types/invoices";

const inputClass =
  "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
const textareaClass =
  "mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function profileAddress(company: BillingCompany) {
  const profile = company.billingProfile;
  if (!profile) return "";
  return [
    profile.address_line_1,
    profile.address_line_2,
    [profile.city, profile.region, profile.postal_code]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join("\n");
}

export function InvoiceEditor({
  companies,
  settings,
  today,
  invoice,
  existingItems = [],
}: {
  companies: BillingCompany[];
  settings: BillingSettings | null;
  today: string;
  invoice?: Invoice | null;
  existingItems?: InvoiceItem[];
}) {
  const router = useRouter();
  const initialCompany =
    companies.find((company) => company.id === invoice?.company_id) ??
    companies[0];
  const initialProfile = initialCompany?.billingProfile;
  const initialTemplate = invoice
    ? null
    : initialCompany?.weeklyInvoiceTemplate;
  const [companyId, setCompanyId] = useState(initialCompany?.id ?? "");
  const [invoiceDate, setInvoiceDate] = useState(
    invoice?.invoice_date ?? today,
  );
  const [dueDate, setDueDate] = useState(
    invoice?.due_date ??
      addDays(
        today,
        initialTemplate?.default_terms_days ??
          initialProfile?.default_payment_terms_days ??
          15,
      ),
  );
  const [currency, setCurrency] = useState(
    invoice?.currency ??
      initialTemplate?.default_currency ??
      settings?.default_currency ??
      "USD",
  );
  const [language, setLanguage] = useState<"es" | "en">(
    invoice?.language ?? initialProfile?.default_language ?? "es",
  );
  const [billingName, setBillingName] = useState(
    invoice?.billing_name_snapshot ??
      initialProfile?.billing_legal_name ??
      initialCompany?.name ??
      "",
  );
  const [billingContact, setBillingContact] = useState(
    invoice?.billing_contact_snapshot ??
      initialProfile?.billing_contact_name ??
      "",
  );
  const [billingEmail, setBillingEmail] = useState(
    invoice?.billing_email_snapshot ??
      initialTemplate?.billing_email ??
      initialProfile?.billing_email ??
      "",
  );
  const [billingCc, setBillingCc] = useState(
    invoice?.billing_cc_snapshot ?? initialProfile?.billing_cc ?? "",
  );
  const [billingAddress, setBillingAddress] = useState(
    invoice?.billing_address_snapshot ??
      (initialCompany ? profileAddress(initialCompany) : ""),
  );
  const [reference, setReference] = useState(
    invoice?.purchase_order_reference ?? "",
  );
  const [clientNote, setClientNote] = useState(
    invoice?.client_note ?? initialProfile?.default_note ?? "",
  );
  const [internalNote, setInternalNote] = useState(
    invoice?.internal_note ?? "",
  );
  const [taxRate, setTaxRate] = useState(
    Number(
      invoice?.tax_rate ??
        initialTemplate?.default_tax_rate ??
        settings?.default_tax_rate ??
        0,
    ),
  );
  const [discountType, setDiscountType] = useState<
    "none" | "fixed" | "percentage"
  >(invoice?.discount_type ?? "none");
  const [discountValue, setDiscountValue] = useState(
    Number(invoice?.discount_value ?? 0),
  );
  const [items, setItems] = useState(
    existingItems.length
      ? existingItems.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
        }))
      : initialTemplate?.default_items?.length
        ? initialTemplate.default_items
        : initialProfile?.default_invoice_items?.length
          ? initialProfile.default_invoice_items
          : [
              {
                description: "Paquete de servicios administrativos",
                quantity: 1,
                unitPrice: 0,
              },
            ],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const totals = useMemo(
    () =>
      calculateInvoiceTotals({ items, discountType, discountValue, taxRate }),
    [discountType, discountValue, items, taxRate],
  );
  const money = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      value,
    );

  function selectCompany(id: string) {
    const company = companies.find((item) => item.id === id);
    if (!company) return;
    const profile = company.billingProfile;
    const template = company.weeklyInvoiceTemplate;
    setCompanyId(id);
    setBillingName(profile?.billing_legal_name || company.name);
    setBillingContact(profile?.billing_contact_name || "");
    setBillingEmail(template?.billing_email || profile?.billing_email || "");
    setBillingCc(profile?.billing_cc || "");
    setBillingAddress(profileAddress(company));
    setLanguage(profile?.default_language || "es");
    setClientNote(profile?.default_note || "");
    setDueDate(
      addDays(
        invoiceDate,
        template?.default_terms_days ??
          profile?.default_payment_terms_days ??
          15,
      ),
    );
    setCurrency(
      template?.default_currency ?? settings?.default_currency ?? "USD",
    );
    setTaxRate(
      Number(template?.default_tax_rate ?? settings?.default_tax_rate ?? 0),
    );
    if (template?.default_items?.length) setItems(template.default_items);
    else if (profile?.default_invoice_items?.length)
      setItems(profile.default_invoice_items);
  }

  function submit() {
    const payload: InvoiceDraftInput = {
      invoiceId: invoice?.id,
      companyId,
      invoiceDate,
      dueDate,
      currency,
      billingName,
      billingContact: billingContact || null,
      billingEmail: billingEmail || null,
      billingCc: billingCc || null,
      billingAddress: billingAddress || null,
      language,
      purchaseOrderReference: reference || null,
      clientNote: clientNote || null,
      internalNote: internalNote || null,
      discountType,
      discountValue,
      taxRate,
      items,
    };
    startTransition(async () => {
      const result = await saveInvoiceDraft(payload);
      if (result.error) return setMessage(result.error);
      router.push(`/dashboard/admin/invoices/${result.invoiceId}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <SurfaceCard>
          <h2 className="font-semibold">Cliente y fechas</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Cliente
              <select
                className={inputClass}
                value={companyId}
                onChange={(event) => selectCompany(event.target.value)}
                required
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Moneda
              <Input
                className="mt-1"
                value={currency}
                maxLength={3}
                onChange={(event) =>
                  setCurrency(event.target.value.toUpperCase())
                }
              />
            </label>
            <label className="text-sm">
              Fecha de factura
              <Input
                className="mt-1"
                type="date"
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
              />
            </label>
            <label className="text-sm">
              Fecha de vencimiento
              <Input
                className="mt-1"
                type="date"
                min={invoiceDate}
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="font-semibold">Datos de facturación</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="Nombre legal"
              value={billingName}
              onChange={setBillingName}
            />
            <TextField
              label="Contacto"
              value={billingContact}
              onChange={setBillingContact}
            />
            <TextField
              label="Correo"
              type="email"
              value={billingEmail}
              onChange={setBillingEmail}
            />
            <TextField label="CC" value={billingCc} onChange={setBillingCc} />
            <label className="text-sm sm:col-span-2">
              Dirección
              <textarea
                className={textareaClass}
                value={billingAddress}
                onChange={(event) => setBillingAddress(event.target.value)}
              />
            </label>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Partidas</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setItems((current) => [
                  ...current,
                  { description: "", quantity: 1, unitPrice: 0 },
                ])
              }
            >
              <Plus className="size-4" /> Añadir
            </Button>
          </div>
          <datalist id="invoice-service-items">
            {[
              "Paquete de servicios administrativos",
              "Nómina semanal",
              "Reportes",
              "Servicios adicionales",
              "Gestión documental",
              "Consultoría",
              "Otro",
            ].map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <div className="mt-4 space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_100px_130px_40px]"
              >
                <Input
                  list="invoice-service-items"
                  aria-label={`Descripción ${index + 1}`}
                  placeholder="Descripción"
                  value={item.description}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, description: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
                <Input
                  aria-label={`Cantidad ${index + 1}`}
                  type="number"
                  min="0.0001"
                  step="0.01"
                  value={item.quantity}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, quantity: Number(event.target.value) }
                          : row,
                      ),
                    )
                  }
                />
                <Input
                  aria-label={`Precio ${index + 1}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, unitPrice: Number(event.target.value) }
                          : row,
                      ),
                    )
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={items.length === 1}
                  onClick={() =>
                    setItems((current) =>
                      current.filter((_, rowIndex) => rowIndex !== index),
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="font-semibold">Notas y ajustes</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="Orden de compra / referencia"
              value={reference}
              onChange={setReference}
            />
            <label className="text-sm">
              Idioma
              <select
                className={inputClass}
                value={language}
                onChange={(event) =>
                  setLanguage(event.target.value as "es" | "en")
                }
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="text-sm">
              Nota para cliente
              <textarea
                className={textareaClass}
                value={clientNote}
                onChange={(event) => setClientNote(event.target.value)}
              />
            </label>
            <label className="text-sm">
              Nota interna
              <textarea
                className={textareaClass}
                value={internalNote}
                onChange={(event) => setInternalNote(event.target.value)}
              />
            </label>
          </div>
        </SurfaceCard>
      </div>

      <div>
        <SurfaceCard className="sticky top-20">
          <h2 className="font-semibold">Resumen</h2>
          <div className="mt-4 space-y-3">
            <label className="text-sm">
              Descuento
              <select
                className={inputClass}
                value={discountType}
                onChange={(event) =>
                  setDiscountType(
                    event.target.value as "none" | "fixed" | "percentage",
                  )
                }
              >
                <option value="none">Sin descuento</option>
                <option value="fixed">Importe fijo</option>
                <option value="percentage">Porcentaje</option>
              </select>
            </label>
            {discountType !== "none" ? (
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discountValue}
                onChange={(event) =>
                  setDiscountValue(Number(event.target.value))
                }
              />
            ) : null}
            <label className="text-sm">
              Impuesto (%)
              <Input
                className="mt-1"
                type="number"
                min="0"
                max="100"
                step="0.0001"
                value={taxRate}
                onChange={(event) => setTaxRate(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="mt-5 space-y-2 border-t pt-4 text-sm">
            <Summary label="Subtotal" value={money(totals.subtotal)} />
            <Summary label="Descuento" value={money(totals.discountAmount)} />
            <Summary label="Impuesto" value={money(totals.taxAmount)} />
            <Summary label="Total" value={money(totals.total)} strong />
          </div>
          {message ? (
            <p className="text-destructive mt-4 text-sm">{message}</p>
          ) : null}
          <Button className="mt-5 w-full" disabled={pending} onClick={submit}>
            {pending ? "Guardando..." : "Guardar borrador"}
          </Button>
          <p className="text-muted-foreground mt-3 text-xs">
            Los totales mostrados son una vista previa. El servidor y PostgreSQL
            los recalculan al guardar.
          </p>
        </SurfaceCard>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-sm">
      {label}
      <Input
        className="mt-1"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Summary({
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
      className={`flex justify-between gap-3 ${strong ? "text-base font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
