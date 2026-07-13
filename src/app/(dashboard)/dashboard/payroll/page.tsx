import { notFound } from "next/navigation";

import { PayrollWorkspace } from "@/components/payroll/payroll-workspace";
import { requireAuth } from "@/lib/auth/session";
import {
  getPayrollWorkspace,
  resolveSibaritaCompany,
} from "@/services/payroll";

export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const profile = await requireAuth();
  const params = await searchParams;
  const requestedId =
    profile.role === "admin" ? params.company : profile.company_id;
  if (!requestedId) notFound();
  const company = await resolveSibaritaCompany(requestedId);
  if (
    !company ||
    (profile.role === "client" && company.id !== profile.company_id)
  )
    notFound();
  const data = await getPayrollWorkspace(company.id);
  return (
    <PayrollWorkspace
      company={company}
      isAdmin={profile.role === "admin"}
      {...data}
    />
  );
}
