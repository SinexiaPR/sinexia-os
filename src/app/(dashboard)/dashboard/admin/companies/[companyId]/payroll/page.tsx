import { notFound } from "next/navigation";

import { TresbePayrollAdminWorkspace } from "@/components/tresbe-payroll/admin-workspace";
import { requireAdmin } from "@/lib/auth/session";
import {
  getTresbeAdminWorkspace,
  resolveTresbeCompany,
} from "@/services/tresbe-payroll";

export const dynamic = "force-dynamic";

export default async function TresbeAdminPayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ payroll?: string }>;
}) {
  await requireAdmin();
  const { companyId } = await params;
  const { payroll } = await searchParams;
  const company = await resolveTresbeCompany(companyId);
  if (!company) notFound();
  const workspace = await getTresbeAdminWorkspace(company.id, payroll);
  return <TresbePayrollAdminWorkspace company={company} {...workspace} />;
}
