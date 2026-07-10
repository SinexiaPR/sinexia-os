import { createClient } from "@/lib/supabase/server";
import type { AppNotification } from "@/types";

export async function getNotificationsForUser(
  limit = 30,
): Promise<AppNotification[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as AppNotification[];
}

export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
