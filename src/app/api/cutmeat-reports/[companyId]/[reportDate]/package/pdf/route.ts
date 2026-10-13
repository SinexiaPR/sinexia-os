import { NextResponse } from "next/server";

import { getProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAndStorePackage,
  getLatestPackage,
  getPackageVersions,
  PackageNotEligibleError,
  resolveCutMeatCompany,
} from "@/services/cutmeat-report-packages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descarga del "Paquete para el dueño": admin, o el cliente de esta
 * empresa (Gabriel) para ver/descargar el paquete del día o uno
 * anterior. Mismo patrón que /api/cutmeat-daily/{companyId}/pdf.
 *
 * ?version=N -- sin version, sirve la más reciente; si todavía no existe
 * ninguna, genera la primera (solo si el llamador es admin -- un cliente
 * nunca dispara una generación desde un GET).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ companyId: string; reportDate: string }> },
) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { companyId, reportDate } = await context.params;
  const company = await resolveCutMeatCompany(companyId);
  if (!company) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  const isAdmin = profile.role === "admin";
  const isOwnClient = profile.role === "client" && profile.company_id === company.id;
  if (!isAdmin && !isOwnClient)
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const versionParam = new URL(request.url).searchParams.get("version");
  let record = versionParam
    ? (await getPackageVersions(companyId, reportDate)).find(
        (pkg) => pkg.version === Number(versionParam),
      ) ?? null
    : await getLatestPackage(companyId, reportDate);

  if (!record) {
    if (versionParam)
      return NextResponse.json({ error: "Versión no encontrada" }, { status: 404 });
    if (!isAdmin)
      return NextResponse.json(
        { error: "Todavía no hay un paquete generado para este día." },
        { status: 404 },
      );
    try {
      record = await buildAndStorePackage(companyId, reportDate, profile.id);
    } catch (error) {
      if (error instanceof PackageNotEligibleError)
        return NextResponse.json({ error: error.reasons.join(" ") }, { status: 400 });
      throw error;
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("cutmeat-daily")
    .createSignedUrl(record.storagePath, 120);
  if (error || !data?.signedUrl)
    return NextResponse.json({ error: "No se pudo generar el enlace de descarga" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}

/**
 * Generar / regenerar el paquete. Solo admin -- Gabriel recibe 403. Se
 * bloquea (400) si el día no está cerrado o hay alertas abiertas.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ companyId: string; reportDate: string }> },
) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (profile.role !== "admin")
    return NextResponse.json(
      { error: "Solo un administrador puede generar el paquete." },
      { status: 403 },
    );
  const { companyId, reportDate } = await context.params;
  const company = await resolveCutMeatCompany(companyId);
  if (!company) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  try {
    const record = await buildAndStorePackage(companyId, reportDate, profile.id);
    return NextResponse.json({ success: true, package: record });
  } catch (error) {
    if (error instanceof PackageNotEligibleError)
      return NextResponse.json({ error: error.reasons.join(" ") }, { status: 400 });
    throw error;
  }
}
