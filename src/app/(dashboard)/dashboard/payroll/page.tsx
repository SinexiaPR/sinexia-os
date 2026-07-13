import { notFound } from "next/navigation";

import { PayrollWorkspace } from "@/components/payroll/payroll-workspace";
import { TresbeClientPayrolls } from "@/components/tresbe-payroll/client-payrolls";
import { requireAuth } from "@/lib/auth/session";
import {
  getPayrollWorkspace,
  resolveSibaritaCompany,
} from "@/services/payroll";
import {
  getTresbeClientWorkspace,
  resolveTresbeCompany,
} from "@/services/tresbe-payroll";

export const dynamic = "force-dynamic";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; payroll?: string }>;
}) {
  const profile = await requireAuth();
  const params = await searchParams;
  if (profile.role === "client" && profile.company_id) {
    const tresbe = await resolveTresbeCompany(profile.company_id);
    if (tresbe) {
      const workspace = await getTresbeClientWorkspace(
        tresbe.id,
        params.payroll,
      );
      return <TresbeClientPayrolls {...workspace} />;
    }
  }
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
