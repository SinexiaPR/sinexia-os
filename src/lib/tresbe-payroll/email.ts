import { env } from "@/config/env";

export type PayrollEmailPayload = {
  to: string;
  cc?: string | null;
  subject: string;
  text: string;
  filename: string;
  pdf: Uint8Array;
};

export type PayrollEmailResult = {
  messageId: string | null;
};

export function isPayrollEmailConfigured() {
  return Boolean(
    env.PAYROLL_EMAIL_PROVIDER_URL &&
    env.PAYROLL_EMAIL_API_KEY &&
    env.PAYROLL_EMAIL_FROM,
  );
}

export async function sendPayrollEmail(
  payload: PayrollEmailPayload,
): Promise<PayrollEmailResult> {
  if (!isPayrollEmailConfigured()) {
    throw new Error("Correo no configurado");
  }

  const response = await fetch(env.PAYROLL_EMAIL_PROVIDER_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYROLL_EMAIL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.PAYROLL_EMAIL_FROM,
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
  if (!response.ok) {
    throw new Error(
      body?.error || body?.message || `Email provider error ${response.status}`,
    );
  }
  return { messageId: body?.id ?? body?.messageId ?? null };
}
