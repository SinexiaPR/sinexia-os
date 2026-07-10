"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(notificationId: string) {
  const profile = await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", profile.id)
    .is("read_at", null);

  if (error) {
    return { error: "No se pudo marcar la notificación." };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function markAllNotificationsRead() {
  const profile = await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", profile.id)
    .is("read_at", null);

  if (error) {
    return { error: "No se pudieron marcar las notificaciones." };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
