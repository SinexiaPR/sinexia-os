import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function requireAuth(): Promise<Profile> {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireAuth();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return profile;
}

export async function requireClient(): Promise<Profile> {
  const profile = await requireAuth();

  if (profile.role !== "client") {
    redirect("/dashboard");
  }

  return profile;
}
