import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { resolveCutMeatCompany } from "@/services/cutmeat-daily";

export const dynamic = "force-dynamic";

const links = [
  { slug: "daily-reports", label: "Informes diarios" },
  { slug: "recurrentes", label: "Recurrentes" },
  { slug: "historial-diario", label: "Historial diario" },
  { slug: "paquete-dueno", label: "PDFs" },
];

export default async function CutMeatInformesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requireAdmin();
  const { companyId } = await params;
  const company = await resolveCutMeatCompany(companyId);
  if (!company) notFound();

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href={`/dashboard/admin/companies/${company.id}`}>
          <ArrowLeft className="size-4" />
          Volver a {company.name}
        </Link>
      </Button>
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {company.name}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          Informes
        </h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <Link
            key={link.slug}
            href={`/dashboard/admin/companies/${company.id}/${link.slug}`}
            className="border-border/80 bg-card hover:border-primary/40 focus-visible:ring-ring/50 rounded-lg border p-5 font-semibold shadow-sm transition outline-none focus-visible:ring-[3px]"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
