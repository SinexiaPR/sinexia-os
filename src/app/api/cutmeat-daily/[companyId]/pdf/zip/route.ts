import JSZip from "jszip";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateDailyPdf, type CutMeatPdfDocType } from "@/actions/cutmeat-daily";
import { getCutMeatReport, resolveCutMeatCompany } from "@/services/cutmeat-daily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOC_TYPES: CutMeatPdfDocType[] = [
  "reconciliation",
  "bank",
  "consolidated",
  "vendors",
  "customers",
];

/**
 * ZIP con los 5 PDF del día (última versión de cada uno). Lo que falte se
 * genera al vuelo (version 1) antes de armar el ZIP.
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

  const date = new URL(request.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  const report = await getCutMeatReport(companyId, date);
  if (!report)
    return NextResponse.json(
      { error: "No hay datos cargados para esa fecha" },
      { status: 404 },
    );

  const admin = createAdminClient();
  const supabase = await createClient();
  const zip = new JSZip();
  const missing: string[] = [];

  for (const docType of DOC_TYPES) {
    const { data: existing } = await supabase
      .from("cutmeat_daily_generated_pdfs")
      .select("storage_path")
      .eq("report_id", report.id)
      .eq("doc_type", docType)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    let storagePath = existing?.storage_path as string | undefined;
    if (!storagePath) {
      const generated = await generateDailyPdf({ companyId, reportDate: date, docType });
      if ("error" in generated) {
        missing.push(docType);
        continue;
      }
      storagePath = generated.storagePath;
    }
    const downloaded = await admin.storage.from("cutmeat-daily").download(storagePath);
    if (downloaded.error) {
      missing.push(docType);
      continue;
    }
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const filename = storagePath.split("/").pop()?.replace(/^v\d+-/, "") ?? `${docType}.pdf`;
    zip.file(filename, bytes);
  }

  if (missing.length === 5)
    return NextResponse.json(
      { error: "Todavía no hay datos cargados para generar ningún PDF de este día." },
      { status: 400 },
    );

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="CUTD-Informes-${date}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
