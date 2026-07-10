import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SiaPanel } from "@/components/assistant/sia-panel";
import { requireAuth } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Asistente",
};

export default async function SiaPage() {
  const profile = await requireAuth();

  if (profile.role === "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Asistente SIA
        </h1>
        <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          Consultas rápidas sobre sus documentos, pendientes de revisión y
          reportes publicados por Sinexia.
        </p>
      </header>

      <SiaPanel />
    </div>
  );
}
