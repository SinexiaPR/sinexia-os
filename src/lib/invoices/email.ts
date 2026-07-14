import { env } from "@/config/env";

export type InvoiceEmailPayload = {
  to: string;
  cc?: string | null;
  subject: string;
  text: string;
  filename: string;
  pdf: Uint8Array;
  replyTo?: string | null;
  senderName?: string | null;
};

export function isInvoiceEmailConfigured() {
  return Boolean(
    env.INVOICE_EMAIL_PROVIDER_URL &&
    env.INVOICE_EMAIL_API_KEY &&
    env.INVOICE_EMAIL_FROM,
  );
}

export async function sendInvoiceEmail(payload: InvoiceEmailPayload) {
  if (!isInvoiceEmailConfigured())
    throw new Error("Proveedor de correo no configurado.");
  const response = await fetch(env.INVOICE_EMAIL_PROVIDER_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.INVOICE_EMAIL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.INVOICE_EMAIL_FROM,
      fromName: payload.senderName || undefined,
      replyTo: payload.replyTo || undefined,
      to: payload.to,
      cc: payload.cc || undefined,
      subject: payload.subject,
      text: payload.text,
      attachments: [
        {
          filename: payload.filename,
          contentType: "application/pdf",
          content: Buffer.from(payload.pdf).toString("base64"),
        },
      ],
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    id?: string;
    messageId?: string;
    error?: string;
    message?: string;
  } | null;
  if (!response.ok)
    throw new Error(
      body?.error || body?.message || `Email provider error ${response.status}`,
    );
  return { messageId: body?.id ?? body?.messageId ?? null };
}
