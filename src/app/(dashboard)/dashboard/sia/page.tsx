import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SinexIAPanel } from "@/components/assistant/sia-panel";
import { assistantConfig } from "@/config/assistant";
import { requireAuth } from "@/lib/auth/session";
import { getReportsForCompany } from "@/services/reports";

export const metadata: Metadata = {
  title: "SinexIA",
};

export default async function SinexIAPage() {
  const profile = await requireAuth();

  if (profile.role === "admin") {
    redirect("/dashboard");
  }

  if (!profile.company_id) {
    return (
      <div className="space-y-2 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">SinexIA</h1>
        <p className="text-muted-foreground">
          Su cuenta no está vinculada a una empresa.
        </p>
      </div>
    );
  }

  const reports = await getReportsForCompany(profile.company_id);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">SinexIA</h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          {assistantConfig.tagline}
        </p>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {assistantConfig.description}
        </p>
      </header>

      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Cargando…</p>
        }
      >
        <SinexIAPanel
          reports={reports.map((r) => ({
            id: r.id,
            title: r.title,
            category: r.category,
            period: r.period,
          }))}
        />
      </Suspense>
    </div>
  );
}
