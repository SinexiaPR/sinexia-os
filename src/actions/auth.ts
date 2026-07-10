"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Invalid email or password." };
  }

  redirect("/dashboard");
}

export async function signOutSession(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: "No se pudo cerrar sesión. Intente de nuevo." };
  }

  revalidatePath("/", "layout");
  return { error: null };
}

export async function signOut() {
  const result = await signOutSession();

  if (result.error) {
    return { error: result.error };
  }

  redirect("/login");
}

export async function updateProfile(formData: FormData): Promise<void> {
  const fullName = String(formData.get("full_name") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null })
    .eq("id", user.id);

  if (error) {
    return;
  }

  revalidatePath("/dashboard/profile");
}
