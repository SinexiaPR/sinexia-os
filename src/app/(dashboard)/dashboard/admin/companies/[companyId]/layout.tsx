import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CompanyHeader } from "@/components/company/company-header";
import { requireAdmin } from "@/lib/auth/session";
import { getCompanyById } from "@/services/documents";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  await requireAdmin();
  const { companyId } = await params;
  const company = await getCompanyById(companyId);
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <CompanyHeader company={company} />
      {children}
    </div>
  );
}
