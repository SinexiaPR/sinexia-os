"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  cancelInvoice,
  deleteInvoice,
  duplicateInvoice,
  emailInvoice,
  generateInvoicePdf,
  issueInvoice,
  markInvoicePaid,
} from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { Invoice } from "@/types/invoices";

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [recipient, setRecipient] = useState(
    invoice.billing_email_snapshot ?? "",
  );
  const [cc, setCc] = useState(invoice.billing_cc_snapshot ?? "");
  const [subject, setSubject] = useState(
    `Factura Sinexia #${invoice.invoice_number ?? ""} — ${invoice.billing_name_snapshot ?? "Cliente"}`,
  );
  const [body, setBody] = useState(
    [
      "Hola,",
      "",
      `Adjuntamos la factura #${invoice.invoice_number ?? ""} correspondiente a los servicios brindados por Sinexia.`,
      "",
      `Cliente: ${invoice.billing_name_snapshot ?? ""}`,
      `Fecha: ${invoice.invoice_date ?? ""}`,
      `Total: ${new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(Number(invoice.total))}`,
      `Vencimiento: ${invoice.due_date ?? ""}`,
      "",
      "La factura se encuentra adjunta en formato PDF.",
      "",
      "Saludos,",
      "Sinexia",
    ].join("\n"),
  );

  function run(
    action: () => Promise<{
      error?: string;
      success?: boolean;
      invoiceId?: string;
      deleted?: boolean;
    } | void>,
  ) {
    startTransition(async () => {
      setMessage(null);
      const result = await action();
      if (result && "error" in result && result.error) setMessage(result.error);
      else if (result && "deleted" in result && result.deleted)
        router.push("/dashboard/admin/invoices");
      else if (result && "invoiceId" in result && result.invoiceId)
        router.push(`/dashboard/admin/invoices/${result.invoiceId}`);
      else setMessage("Operación completada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <SurfaceCard padding="sm">
        <div className="flex flex-wrap gap-2">
          {invoice.status === "draft" ? (
            <>
              <Button
                onClick={() => run(() => issueInvoice(invoice.id))}
                disabled={pending}
              >
                Emitir factura
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/dashboard/admin/invoices/${invoice.id}?edit=1`)
                }
              >
                Editar borrador
              </Button>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm(
                      "¿Eliminar este borrador? No consume número oficial.",
                    )
                  )
                    run(() => deleteInvoice(invoice.id));
                }}
              >
                Eliminar factura
              </Button>
            </>
          ) : (
            <>
              {invoice.pdf_storage_path ? (
                <Button asChild variant="outline">
                  <a href={`/api/invoices/${invoice.id}/download`}>
                    Descargar PDF
                  </a>
                </Button>
              ) : null}
              {!invoice.pdf_storage_path && !invoice.is_legacy_import ? (
                <Button
                  disabled={pending}
                  onClick={() => run(() => generateInvoicePdf(invoice.id))}
                >
                  Generar PDF
                </Button>
              ) : null}
              {!invoice.is_legacy_import ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => duplicateInvoice(invoice.id))}
                >
                  Duplicar como borrador
                </Button>
              ) : null}
              {invoice.status === "cancelled" && !invoice.is_legacy_import ? (
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Eliminar definitivamente la factura cancelada #${invoice.invoice_number}? Su número oficial no se reutilizará.`,
                      )
                    )
                      run(() => deleteInvoice(invoice.id));
                  }}
                >
                  Eliminar factura
                </Button>
              ) : null}
              {!["paid", "cancelled"].includes(invoice.status) ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    const reference =
                      window.prompt("Referencia de pago (opcional)") ??
                      undefined;
                    run(() => markInvoicePaid(invoice.id, reference));
                  }}
                >
                  Marcar pagada
                </Button>
              ) : null}
              {!["paid", "cancelled"].includes(invoice.status) ? (
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    const reason = window.prompt("Motivo de cancelación");
                    if (reason) run(() => cancelInvoice(invoice.id, reason));
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
            </>
          )}
        </div>
        {message ? (
          <p className="text-muted-foreground mt-3 text-sm">{message}</p>
        ) : null}
      </SurfaceCard>

      {invoice.invoice_number &&
      invoice.pdf_storage_path &&
      invoice.status !== "cancelled" ? (
        <SurfaceCard>
          <h2 className="font-semibold">Enviar por correo</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Confirma destinatario, mensaje, número y total antes de enviar.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Destinatario
              <Input
                className="mt-1"
                type="email"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
              />
            </label>
            <label className="text-sm">
              CC
              <Input
                className="mt-1"
                value={cc}
                onChange={(event) => setCc(event.target.value)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              Asunto
              <Input
                className="mt-1"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              Mensaje
              <textarea
                className="bg-background mt-1 min-h-48 w-full rounded-md border px-3 py-2 text-sm"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
          </div>
          <div className="bg-muted mt-4 rounded-lg p-3 text-sm">
            Factura #{invoice.invoice_number} · Total{" "}
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: invoice.currency,
            }).format(Number(invoice.total))}
          </div>
          <Button
            className="mt-4"
            disabled={pending || !recipient}
            onClick={() => {
              if (
                window.confirm(
                  `¿Enviar la factura #${invoice.invoice_number} a ${recipient}?`,
                )
              )
                run(() =>
                  emailInvoice({
                    invoiceId: invoice.id,
                    recipient,
                    cc: cc || null,
                    subject,
                    message: body,
                  }),
                );
            }}
          >
            Enviar por correo
          </Button>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
