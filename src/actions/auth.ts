"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "El correo y la contraseña son obligatorios." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/dashboard");
}

function clearSupabaseAuthCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  const authCookies = cookieStore
    .getAll()
    .filter(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
    );

  for (const cookie of authCookies) {
    cookieStore.set(cookie.name, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    cookieStore.delete(cookie.name);
  }
}

/**
 * Ends the Supabase session, clears auth cookies, and redirects to /login.
 * Shared by every Cerrar sesión control (sidebar, sheet, account menu).
 */
export async function signOut() {
  const cookieStore = await cookies();
  const supabase = await createClient();

  // Clears the session and asks the SSR cookie adapter to expire auth cookies.
  await supabase.auth.signOut({ scope: "local" });

  // Belt-and-suspenders: explicitly expire any remaining Supabase auth cookies
  // so middleware no longer treats the browser as authenticated.
  clearSupabaseAuthCookies(cookieStore);

  revalidatePath("/", "layout");
  revalidatePath("/dashboard", "layout");
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
