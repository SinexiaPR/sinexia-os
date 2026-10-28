import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
  return (
    <div className="border-border bg-card rounded-xl border p-6 shadow-[var(--shadow-card)] sm:p-8">
      <LoginForm />
    </div>
  );
}
