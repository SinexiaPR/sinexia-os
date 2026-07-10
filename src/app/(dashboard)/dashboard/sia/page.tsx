import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SiaPanel } from "@/components/assistant/sia-panel";
import { requireAuth } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "SIA",
};

export default async function SiaPage() {
  const profile = await requireAuth();

  if (profile.role === "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">SIA</h1>
        <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
          Sinexia Intelligent Assistant — consultas rápidas sobre su Inbox,
          documentos en revisión y reportes publicados por Sinexia.
        </p>
      </header>

      <SiaPanel />
    </div>
  );
}
