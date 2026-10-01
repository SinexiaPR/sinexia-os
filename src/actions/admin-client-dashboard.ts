"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const manualStatusSchema = z.object({
  itemId: z.string().uuid(),
  status: z.enum(["done", "in_progress", "pending"]),
  label: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => v || null),
});

export async function setManualDashboardItemStatus(
  itemId: string,
  status: "done" | "in_progress" | "pending",
  label?: string,
) {
  const profile = await requireAdmin();
  const parsed = manualStatusSchema.safeParse({ itemId, status, label });
  if (!parsed.success) return { error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_dashboard_items")
    .update({
      manual_status: parsed.data.status,
      manual_status_label: parsed.data.label,
      manual_status_updated_by: profile.id,
      manual_status_updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.itemId)
    .eq("action_type", "manual");
  if (error) return { error: "No se pudo actualizar el estado." };
  revalidatePath("/dashboard");
  return { success: true };
}
