import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateDailyPdf, type CutMeatPdfDocType } from "@/actions/cutmeat-daily";
import { getCutMeatReport, resolveCutMeatCompany } from "@/services/cutmeat-daily";
import type { IsoDate } from "@/lib/cutmeat-daily/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOC_TYPES = new Set<CutMeatPdfDocType>([
  "reconciliation",
  "bank",
  "consolidated",
  "vendors",
  "customers",
]);

/**
 * Descarga de los PDF de "Informes diarios" (Cut Meat Distributors). Módulo
 * interno: sin excepción para el portal cliente, igual que el presupuesto
 * de Tresbe.
 *
 * ?date=YYYY-MM-DD&doc=consolidated|reconciliation|bank|vendors|customers
 * [&version=N] -- sin version, sirve la más reciente; si todavía no existe
 * ninguna, genera la primera (version 1) antes de servirla.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ companyId: string }> },
) {
  await requireAdmin();
  const { companyId } = await context.params;
  const company = await resolveCutMeatCompany(companyId);
  if (!company)
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  const url = new URL(request.url);
  const date = url.searchParams.get("date") as IsoDate | null;
  const doc = url.searchParams.get("doc") as CutMeatPdfDocType | null;
  const versionParam = url.searchParams.get("version");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !doc || !DOC_TYPES.has(doc))
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

  const report = await getCutMeatReport(companyId, date);
  if (!report)
    return NextResponse.json(
      { error: "No hay datos cargados para esa fecha" },
      { status: 404 },
    );

  const admin = createAdminClient();
  const supabase = await createClient();
  let query = supabase
    .from("cutmeat_daily_generated_pdfs")
    .select("storage_path,version")
    .eq("report_id", report.id)
    .eq("doc_type", doc);
  query = versionParam
    ? query.eq("version", Number(versionParam))
    : query.order("version", { ascending: false }).limit(1);
  const { data: existing, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let storagePath = existing?.storage_path as string | undefined;
  if (!storagePath) {
    if (versionParam)
      return NextResponse.json({ error: "Versión no encontrada" }, { status: 404 });
    const generated = await generateDailyPdf({ companyId, reportDate: date, docType: doc });
    if ("error" in generated)
      return NextResponse.json({ error: generated.error }, { status: 400 });
    storagePath = generated.storagePath;
  }

  const { data: signed, error: signedError } = await admin.storage
    .from("cutmeat-daily")
    .createSignedUrl(storagePath, 120);
  if (signedError || !signed?.signedUrl)
    return NextResponse.json(
      { error: "No se pudo generar el enlace de descarga" },
      { status: 500 },
    );
  return NextResponse.redirect(signed.signedUrl);
}
