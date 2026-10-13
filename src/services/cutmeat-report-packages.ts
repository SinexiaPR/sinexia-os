import { createHash } from "node:crypto";

import { notFound, redirect } from "next/navigation";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { generateDailyPdf, type CutMeatPdfDocType } from "@/actions/cutmeat-daily";
import { requireAuth } from "@/lib/auth/session";
import { applyHighlights } from "@/lib/cutmeat-reports/package/highlights";
import { buildPackagePlan, type PackagePageCounts } from "@/lib/cutmeat-reports/package/plan";
import { renderPdfPageToPng } from "@/lib/cutmeat-reports/package/render";
import { money } from "@/lib/cutmeat-daily/pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getCutMeatReport,
  getDailyReportWorkspace,
  resolveCutMeatCompany,
} from "@/services/cutmeat-daily";

export { resolveCutMeatCompany };

/**
 * Igual regla que el resto de este módulo (ver requireCutMeatAccess en
 * services/cutmeat-recurrentes.ts): admin lee y escribe, Gabriel (el
 * cliente de esta empresa, el dueño) solo lee. "Informes diarios" es
 * admin-only sin excepción; el paquete para el dueño sí tiene esta
 * excepción explícita, así que vive en su propia página en vez de la de
 * "Informes diarios".
 */
export async function requirePackageAccess(companyId: string) {
  const profile = await requireAuth();
  const company = await resolveCutMeatCompany(companyId);
  if (!company) notFound();
  const isOwnClient = profile.role === "client" && profile.company_id === company.id;
  if (profile.role !== "admin" && !isOwnClient) redirect("/dashboard");
  return { profile, company, canWrite: profile.role === "admin" };
}

const PACKAGE_DOC_TYPES: CutMeatPdfDocType[] = [
  "reconciliation",
  "bank",
  "consolidated",
  "vendors",
  "customers",
];

export type CutMeatReportPackage = {
  id: string;
  companyId: string;
  reportDate: string;
  version: number;
  storagePath: string;
  coverImagePath: string | null;
  contentHash: string;
  generatedBy: string | null;
  generatedAt: string;
  sentToOwner: boolean;
  sentMarkedBy: string | null;
  sentMarkedAt: string | null;
};

function mapRow(row: Record<string, unknown>): CutMeatReportPackage {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    reportDate: row.report_date as string,
    version: row.version as number,
    storagePath: row.storage_path as string,
    coverImagePath: row.cover_image_path as string | null,
    contentHash: row.content_hash as string,
    generatedBy: row.generated_by as string | null,
    generatedAt: row.generated_at as string,
    sentToOwner: row.sent_to_owner as boolean,
    sentMarkedBy: row.sent_marked_by as string | null,
    sentMarkedAt: row.sent_marked_at as string | null,
  };
}

export async function getPackageVersions(
  companyId: string,
  reportDate: string,
): Promise<CutMeatReportPackage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_report_packages")
    .select("*")
    .eq("company_id", companyId)
    .eq("report_date", reportDate)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getLatestPackage(
  companyId: string,
  reportDate: string,
): Promise<CutMeatReportPackage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cutmeat_report_packages")
    .select("*")
    .eq("company_id", companyId)
    .eq("report_date", reportDate)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export type PackageEligibility = {
  eligible: boolean;
  reasons: string[];
};

/**
 * El botón "Paquete para el dueño" solo se habilita con el día cerrado y
 * sin alertas bloqueantes abiertas -- reutiliza exactamente las mismas
 * alertas que ya se muestran en "Informes diarios"
 * (checkDailyReportCompleteness), no se inventa un segundo criterio.
 * Las alertas "info" (hoy, recurrente vencido sin pago -- el bucket
 * normal Prior + This week) se siguen mostrando en pantalla pero no
 * bloquean el paquete.
 */
export async function checkPackageEligibility(
  companyId: string,
  reportDate: string,
): Promise<PackageEligibility> {
  const workspace = await getDailyReportWorkspace(companyId, reportDate);
  const reasons: string[] = [];
  if (!workspace.report) {
    reasons.push("Todavía no hay datos cargados para este día.");
  } else if (workspace.report.status !== "closed") {
    reasons.push("El día no está cerrado.");
  }
  const additionalWarnings = "warnings" in workspace ? workspace.warnings ?? [] : [];
  reasons.push(
    ...additionalWarnings
      .filter((warning) => warning.severity === "blocking")
      .map((warning) => warning.message),
  );
  return { eligible: reasons.length === 0, reasons };
}

export class PackageNotEligibleError extends Error {
  reasons: string[];
  constructor(reasons: string[]) {
    super(reasons.join(" "));
    this.reasons = reasons;
  }
}

/**
 * Arma el "Paquete para el dueño": portada (última hoja del Consolidado,
 * con 3 cifras resaltadas) + Reconciliation + Export + Consolidado sin su
 * última hoja + Aging Vendors + Aging Customers, en un solo PDF.
 *
 * SIEMPRE regenera los 5 PDF individuales desde los datos actuales del
 * día (generateDailyPdf), nunca reutiliza una versión ya guardada: un
 * paquete armado con un PDF viejo (de antes de corregir un dato, o de
 * antes de un fix en el generador) queda con cifras y paginación
 * desactualizadas sin ningún aviso, que es justo lo que pasó la primera
 * vez que se armó el paquete del 09/10 -- reusó los PDF de las primeras
 * pruebas en vez de generarlos de nuevo. Cada llamada crea una versión
 * nueva del paquete Y de cada uno de los 5 PDF; nunca sobrescribe una
 * anterior (igual que generateDailyPdf ya hace por su cuenta).
 */
export async function buildAndStorePackage(
  companyId: string,
  reportDate: string,
  generatedBy: string,
): Promise<CutMeatReportPackage> {
  const eligibility = await checkPackageEligibility(companyId, reportDate);
  if (!eligibility.eligible) throw new PackageNotEligibleError(eligibility.reasons);

  const report = await getCutMeatReport(companyId, reportDate);
  if (!report) throw new PackageNotEligibleError(["Todavía no hay datos cargados para este día."]);

  const workspace = await getDailyReportWorkspace(companyId, reportDate);
  if (!workspace.settings) {
    throw new PackageNotEligibleError(["La empresa no tiene configuración inicial."]);
  }

  const admin = createAdminClient();

  const sourceBytes: Record<CutMeatPdfDocType, Uint8Array> = {} as Record<
    CutMeatPdfDocType,
    Uint8Array
  >;
  for (const docType of PACKAGE_DOC_TYPES) {
    const generated = await generateDailyPdf({ companyId, reportDate, docType });
    if ("error" in generated)
      throw new PackageNotEligibleError([generated.error ?? "No se pudo generar el PDF."]);
    const downloaded = await admin.storage.from("cutmeat-daily").download(generated.storagePath);
    if (downloaded.error) throw downloaded.error;
    sourceBytes[docType] = new Uint8Array(await downloaded.data.arrayBuffer());
  }

  const sourceDocs = Object.fromEntries(
    await Promise.all(
      PACKAGE_DOC_TYPES.map(async (docType) => [docType, await PDFDocument.load(sourceBytes[docType])] as const),
    ),
  ) as Record<CutMeatPdfDocType, PDFDocument>;

  const pageCounts = Object.fromEntries(
    PACKAGE_DOC_TYPES.map((docType) => [docType, sourceDocs[docType].getPageCount()]),
  ) as PackagePageCounts;
  const plan = buildPackagePlan(pageCounts);

  const packageDoc = await PDFDocument.create();
  let coverPageIndex: number | null = null;
  for (const step of plan.steps) {
    const copiedPages = await packageDoc.copyPages(sourceDocs[step.doc], step.pageIndexes);
    for (const copiedPage of copiedPages) {
      packageDoc.addPage(copiedPage);
      if (step.isCover) coverPageIndex = packageDoc.getPageCount() - 1;
    }
  }
  if (coverPageIndex == null) throw new Error("No se pudo determinar la portada del paquete.");

  const boldFont = await packageDoc.embedFont(StandardFonts.HelveticaBold);
  applyHighlights(packageDoc.getPage(coverPageIndex), boldFont, {
    first_bank_accounts: money(workspace.financial?.balanceToday ?? null),
    aging_vendors_consolidated: money(workspace.vendorAging?.consolidated ?? null),
    aging_customers_consolidated: money(workspace.customerAging?.consolidated ?? null),
  });

  const packageBytes = await packageDoc.save();
  const contentHash = createHash("sha256").update(packageBytes).digest("hex");

  // La portada se renderiza ANTES de tocar Storage: si pdfjs-dist/
  // @napi-rs/canvas fallan acá (p. ej. el worker faltante en
  // producción), todavía no se subió nada, así que no queda ningún
  // archivo huérfano por ese motivo.
  const cover = await renderPdfPageToPng(packageBytes, 1, 1600);

  const supabase = await createClient();
  const latestVersion = await getLatestPackage(companyId, reportDate);
  const version = (latestVersion?.version ?? 0) + 1;

  const packagePath = `${companyId}/${reportDate}/package/v${version}-CUTD-Package-${reportDate}.pdf`;
  const coverPath = `${companyId}/${reportDate}/package/v${version}-CUTD-Portada-${reportDate}.png`;

  // Todo o nada: si algo falla después de subir el PDF (la portada, o
  // la fila en cutmeat_report_packages), se borra lo que ya se subió en
  // este intento en vez de dejarlo huérfano. upsert:true además deja
  // que un reintento posterior pise limpio un archivo que haya quedado
  // de un intento anterior fallido con la misma versión (p. ej. uno
  // interrumpido antes de este fix).
  const uploadedPdf = await admin.storage.from("cutmeat-daily").upload(packagePath, packageBytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadedPdf.error) throw uploadedPdf.error;

  const uploadedCover = await admin.storage.from("cutmeat-daily").upload(coverPath, cover.png, {
    contentType: "image/png",
    upsert: true,
  });
  if (uploadedCover.error) {
    await admin.storage.from("cutmeat-daily").remove([packagePath]);
    throw uploadedCover.error;
  }

  const inserted = await supabase
    .from("cutmeat_report_packages")
    .insert({
      company_id: companyId,
      report_date: reportDate,
      version,
      storage_path: packagePath,
      cover_image_path: coverPath,
      content_hash: contentHash,
      generated_by: generatedBy,
    })
    .select("*")
    .single();
  if (inserted.error) {
    await admin.storage.from("cutmeat-daily").remove([packagePath, coverPath]);
    throw inserted.error;
  }
  return mapRow(inserted.data);
}

export async function markPackageSentToOwner(
  packageId: string,
  companyId: string,
  markedBy: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cutmeat_report_packages")
    .update({ sent_to_owner: true, sent_marked_by: markedBy, sent_marked_at: new Date().toISOString() })
    .eq("id", packageId)
    .eq("company_id", companyId);
  if (error) throw error;
}
