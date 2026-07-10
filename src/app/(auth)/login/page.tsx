import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-[0_1px_2px_rgba(18,32,51,0.04)] sm:p-8">
      <LoginForm />
    </div>
  );
}
