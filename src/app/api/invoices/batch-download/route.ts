import JSZip from "jszip";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const supabase = await createClient();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,pdf_storage_path,companies(slug)")
    .in("id", parsed.data.invoiceIds)
    .not("pdf_storage_path", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invoices?.length)
    return NextResponse.json({ error: "No hay PDFs disponibles para descargar." }, { status: 404 });

  const admin = createAdminClient();
  const zip = new JSZip();
  for (const invoice of invoices) {
    const path = invoice.pdf_storage_path as string;
    const downloaded = await admin.storage.from("invoices").download(path);
    if (downloaded.error) continue;
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const companySlug = (invoice.companies as unknown as { slug: string } | null)?.slug ?? "cliente";
    const safeCompany = companySlug
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9-]+/g, "-")
      .toUpperCase();
    zip.file(`FACTURA-${invoice.invoice_number}-${safeCompany}.pdf`, bytes);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="facturas-lote-${new Date().toISOString().slice(0, 10)}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
