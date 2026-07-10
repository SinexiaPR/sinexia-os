"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type SignOutState = {
  error: string | null;
};

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

export async function signOut(
  _prevState: SignOutState,
  _formData: FormData,
): Promise<SignOutState> {
  console.log("[auth] logout started");

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[auth] signOut error:", error.message);
    return { error: "No se pudo cerrar sesión. Intente de nuevo." };
  }

  console.log("[auth] signOut success");
  revalidatePath("/", "layout");
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
