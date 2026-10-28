import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { notFound } from "next/navigation";

import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CutNominaPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireAdmin();
  const { companyId } = await params;
  const supabase = await createClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("id,name,slug")
    .eq("id", companyId)
    .eq("slug", "cut")
    .maybeSingle();
  if (error) throw error;
  if (!company) notFound();

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: "Clientes", href: "/dashboard/admin/companies" },
          {
            label: company.name,
            href: `/dashboard/admin/companies/${company.id}`,
          },
          { label: "Nómina" },
        ]}
      />
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {company.name}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Nómina</h1>
      </div>
      <SurfaceCard>
        <p className="text-muted-foreground text-sm">Próximamente.</p>
      </SurfaceCard>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Vacaciones y enfermedad</h2>
        <SurfaceCard>
          <p className="text-muted-foreground text-sm">Próximamente.</p>
        </SurfaceCard>
      </section>
    </div>
  );
}
