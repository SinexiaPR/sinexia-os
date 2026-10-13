"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { markPackageSentToOwner } from "@/services/cutmeat-report-packages";
import { resolveCutMeatCompany } from "@/services/cutmeat-daily";

function failure(error: unknown) {
  return {
    error: error instanceof Error ? error.message : "No se pudo completar la acción.",
  };
}

const markSentSchema = z.object({
  companyId: z.string().uuid(),
  packageId: z.string().uuid(),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Marca una versión del paquete como "enviada al dueño". La marca la
 * pone un admin a mano -- el sistema no sabe si de verdad se mandó por
 * WhatsApp, solo registra quién y cuándo apretó el botón.
 */
export async function markSentToOwner(input: z.infer<typeof markSentSchema>) {
  const parsed = markSentSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos." };
  const data = parsed.data;
  try {
    const profile = await requireAdmin();
    const company = await resolveCutMeatCompany(data.companyId);
    if (!company) throw new Error("Empresa no encontrada.");
    await markPackageSentToOwner(data.packageId, data.companyId, profile.id);
    revalidatePath(`/dashboard/admin/companies/${data.companyId}/daily-reports`);
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}
