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
 * Descarga de la portada como imagen (PNG) -- para enviar por WhatsApp a
 * mano. Nunca se envía desde acá, solo se genera y se descarga. Misma
 * regla de acceso y de bloqueo que el paquete: admin o Gabriel (el
 * cliente de esta empresa) pueden descargar; generarla de cero (si
 * todavía no existe ninguna) exige que el día esté cerrado y sin
 * alertas, y solo un admin puede disparar esa generación.
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
        { error: "Todavía no hay una portada generada para este día." },
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
  if (!record.coverImagePath)
    return NextResponse.json({ error: "Esta versión no tiene portada generada." }, { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("cutmeat-daily")
    .createSignedUrl(record.coverImagePath, 120);
  if (error || !data?.signedUrl)
    return NextResponse.json({ error: "No se pudo generar el enlace de descarga" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
