"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const settingsSchema = z.object({
  companyId: z.string().uuid(),
  sickBalanceCapHours: z.number().positive(),
});
export type LeaveAccrualSettingsInput = z.infer<typeof settingsSchema>;

export async function saveLeaveAccrualSettings(input: LeaveAccrualSettingsInput) {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success)
    return { error: "El límite de enfermedad debe ser un número mayor que cero." };
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("leave_accrual_settings").upsert(
    {
      company_id: parsed.data.companyId,
      sick_balance_cap_hours: parsed.data.sickBalanceCapHours,
    },
    { onConflict: "company_id" },
  );
  if (error) return { error: error.message };
  revalidatePath("/dashboard/admin/leave-accrual");
  return { success: true };
}
