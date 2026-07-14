"use client";

import { useMemo, useState, useTransition } from "react";

import {
  saveBillingSettings,
  saveCompanyBillingProfile,
  uploadBillingAsset,
} from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { BillingCompany, BillingSettings } from "@/types/invoices";

const textArea =
  "mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm";

export function BillingSettingsWorkspace({
  settings,
  companies,
  initialCompanyId,
}: {
  settings: BillingSettings | null;
  companies: BillingCompany[];
  initialCompanyId?: string;
}) {
  const [companyId, setCompanyId] = useState(
    initialCompanyId ?? companies[0]?.id ?? "",
  );
  const selected = useMemo(
    () => companies.find((company) => company.id === companyId) ?? companies[0],
    [companies, companyId],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string; success?: boolean }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.error ?? "Configuración guardada.");
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className="bg-muted rounded-lg px-4 py-3 text-sm">{message}</p>
      ) : null}
      <SurfaceCard>
        <h2 className="font-semibold">Emisor Sinexia</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Solo administradores pueden consultar estos datos. La información de
          pago se usa en el PDF final.
        </p>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            run(() =>
              saveBillingSettings({
                issuerLegalName:
                  String(form.get("issuerLegalName") || "") || null,
                issuerDisplayName: String(
                  form.get("issuerDisplayName") || "Sinexia",
                ),
                addressLine1: String(form.get("addressLine1") || "") || null,
                addressLine2: String(form.get("addressLine2") || "") || null,
                city: String(form.get("city") || "") || null,
                region: String(form.get("region") || "") || null,
                postalCode: String(form.get("postalCode") || "") || null,
                contactEmail: String(form.get("contactEmail") || "") || null,
                phone: String(form.get("phone") || "") || null,
                paymentMethodLabel:
                  String(form.get("paymentMethodLabel") || "") || null,
                bankAccountName:
                  String(form.get("bankAccountName") || "") || null,
                bankAccountNumber:
                  String(form.get("bankAccountNumber") || "") || null,
                routingNumber: String(form.get("routingNumber") || "") || null,
                defaultCurrency: String(
                  form.get("defaultCurrency") || "USD",
                ).toUpperCase(),
                defaultTaxRate: Number(form.get("defaultTaxRate") || 0),
                defaultFooter: String(form.get("defaultFooter") || "") || null,
                signatureText: String(form.get("signatureText") || "") || null,
                emailSenderName:
                  String(form.get("emailSenderName") || "") || null,
                replyToEmail: String(form.get("replyToEmail") || "") || null,
              }),
            );
          }}
        >
          <Field
            name="issuerLegalName"
            label="Nombre legal"
            value={settings?.issuer_legal_name}
          />
          <Field
            name="issuerDisplayName"
            label="Nombre visible"
            value={settings?.issuer_display_name ?? "Sinexia"}
            required
          />
          <Field
            name="addressLine1"
            label="Dirección"
            value={settings?.address_line_1}
          />
          <Field
            name="addressLine2"
            label="Dirección 2"
            value={settings?.address_line_2}
          />
          <Field name="city" label="Ciudad" value={settings?.city} />
          <Field
            name="region"
            label="Estado / territorio"
            value={settings?.region}
          />
          <Field
            name="postalCode"
            label="Código postal"
            value={settings?.postal_code}
          />
          <Field
            name="contactEmail"
            label="Correo de contacto"
            type="email"
            value={settings?.contact_email}
          />
          <Field name="phone" label="Teléfono" value={settings?.phone} />
          <Field
            name="paymentMethodLabel"
            label="Método de pago"
            value={settings?.payment_method_label}
          />
          <Field
            name="bankAccountName"
            label="Nombre de cuenta"
            value={settings?.bank_account_name}
          />
          <Field
            name="bankAccountNumber"
            label="Número de cuenta"
            value={settings?.bank_account_number}
          />
          <Field
            name="routingNumber"
            label="Routing number"
            value={settings?.routing_number}
          />
          <Field
            name="defaultCurrency"
            label="Moneda predeterminada"
            value={settings?.default_currency ?? "USD"}
            required
          />
          <Field
            name="defaultTaxRate"
            label="Impuesto predeterminado (%)"
            type="number"
            value={String(settings?.default_tax_rate ?? 0)}
          />
          <Field
            name="emailSenderName"
            label="Nombre del remitente"
            value={settings?.email_sender_name}
          />
          <Field
            name="replyToEmail"
            label="Correo Reply-To"
            type="email"
            value={settings?.reply_to_email}
          />
          <label className="text-sm sm:col-span-2">
            Pie de factura
            <textarea
              className={textArea}
              name="defaultFooter"
              defaultValue={settings?.default_footer ?? ""}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Firma (texto)
            <textarea
              className={textArea}
              name="signatureText"
              defaultValue={settings?.signature_text ?? ""}
            />
          </label>
          <Button
            className="sm:col-span-2 sm:w-fit"
            type="submit"
            disabled={pending}
          >
            Guardar datos del emisor
          </Button>
        </form>
        <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2">
          <BillingAssetForm
            kind="logo"
            label="Logo"
            configured={Boolean(settings?.logo_storage_path)}
            pending={pending}
            onSave={run}
          />
          <BillingAssetForm
            kind="signature"
            label="Firma (imagen)"
            configured={Boolean(settings?.signature_storage_path)}
            pending={pending}
            onSave={run}
          />
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <h2 className="font-semibold">
          Editar datos de facturación del cliente
        </h2>
        <select
          className="bg-background mt-4 h-9 w-full max-w-md rounded-md border px-3 text-sm"
          value={selected?.id ?? ""}
          onChange={(event) => setCompanyId(event.target.value)}
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        {selected ? (
          <CompanyProfileForm
            key={selected.id}
            company={selected}
            pending={pending}
            onSave={run}
          />
        ) : null}
      </SurfaceCard>
    </div>
  );
}

function BillingAssetForm({
  kind,
  label,
  configured,
  pending,
  onSave,
}: {
  kind: "logo" | "signature";
  label: string;
  configured: boolean;
  pending: boolean;
  onSave: (
    action: () => Promise<{ error?: string; success?: boolean }>,
  ) => void;
}) {
  return (
    <form
      className="rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("kind", kind);
        onSave(() => uploadBillingAsset(formData));
      }}
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="text-muted-foreground mt-1 text-xs">
        {configured ? "Imagen configurada." : "Sin imagen configurada."} PNG o
        JPG, máximo 2 MB.
      </p>
      <Input
        className="mt-3"
        name="file"
        type="file"
        accept="image/png,image/jpeg"
        required
      />
      <Button className="mt-3" type="submit" disabled={pending}>
        Cargar {label.toLowerCase()}
      </Button>
    </form>
  );
}

function CompanyProfileForm({
  company,
  pending,
  onSave,
}: {
  company: BillingCompany;
  pending: boolean;
  onSave: (
    action: () => Promise<{ error?: string; success?: boolean }>,
  ) => void;
}) {
  const profile = company.billingProfile;
  return (
    <form
      className="mt-5 grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        let defaultItems: Array<{
          description: string;
          quantity: number;
          unitPrice: number;
        }> = [];
        try {
          defaultItems = JSON.parse(
            String(form.get("defaultInvoiceItems") || "[]"),
          );
        } catch {
          return;
        }
        onSave(() =>
          saveCompanyBillingProfile({
            companyId: company.id,
            invoicesEnabled: form.get("invoicesEnabled") === "on",
            billingLegalName:
              String(form.get("billingLegalName") || "") || null,
            billingContactName:
              String(form.get("billingContactName") || "") || null,
            billingEmail: String(form.get("billingEmail") || "") || null,
            billingCc: String(form.get("billingCc") || "") || null,
            addressLine1: String(form.get("addressLine1") || "") || null,
            addressLine2: String(form.get("addressLine2") || "") || null,
            city: String(form.get("city") || "") || null,
            region: String(form.get("region") || "") || null,
            postalCode: String(form.get("postalCode") || "") || null,
            defaultPaymentTermsDays: Number(
              form.get("defaultPaymentTermsDays") || 15,
            ),
            defaultLanguage: String(form.get("defaultLanguage") || "es") as
              "es" | "en",
            defaultNote: String(form.get("defaultNote") || "") || null,
            defaultInvoiceItems: defaultItems,
          }),
        );
      }}
    >
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="invoicesEnabled"
          defaultChecked={profile?.invoices_enabled ?? false}
        />{" "}
        Habilitar módulo Facturas para este cliente
      </label>
      <Field
        name="billingLegalName"
        label="Nombre legal"
        value={profile?.billing_legal_name ?? company.name}
      />
      <Field
        name="billingContactName"
        label="Contacto"
        value={profile?.billing_contact_name}
      />
      <Field
        name="billingEmail"
        label="Correo"
        type="email"
        value={profile?.billing_email}
      />
      <Field name="billingCc" label="CC" value={profile?.billing_cc} />
      <Field
        name="addressLine1"
        label="Dirección"
        value={profile?.address_line_1}
      />
      <Field
        name="addressLine2"
        label="Dirección 2"
        value={profile?.address_line_2}
      />
      <Field name="city" label="Ciudad" value={profile?.city} />
      <Field
        name="region"
        label="Estado / territorio"
        value={profile?.region}
      />
      <Field
        name="postalCode"
        label="Código postal"
        value={profile?.postal_code}
      />
      <Field
        name="defaultPaymentTermsDays"
        label="Términos (días)"
        type="number"
        value={String(profile?.default_payment_terms_days ?? 15)}
      />
      <label className="text-sm">
        Idioma
        <select
          name="defaultLanguage"
          defaultValue={profile?.default_language ?? "es"}
          className="bg-background mt-1 h-9 w-full rounded-md border px-3 text-sm"
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        Nota predeterminada
        <textarea
          className={textArea}
          name="defaultNote"
          defaultValue={profile?.default_note ?? ""}
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Partidas predeterminadas (JSON)
        <textarea
          className={`${textArea} font-mono text-xs`}
          name="defaultInvoiceItems"
          defaultValue={JSON.stringify(
            profile?.default_invoice_items ?? [],
            null,
            2,
          )}
        />
      </label>
      <Button
        className="sm:col-span-2 sm:w-fit"
        type="submit"
        disabled={pending}
      >
        Guardar cliente
      </Button>
    </form>
  );
}

function Field({
  name,
  label,
  value,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  value?: string | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm">
      {label}
      <Input
        className="mt-1"
        name={name}
        type={type}
        defaultValue={value ?? ""}
        required={required}
        step={type === "number" ? "0.0001" : undefined}
      />
    </label>
  );
}
