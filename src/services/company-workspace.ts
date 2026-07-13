import { createClient } from "@/lib/supabase/server";
import {
  COMPANY_CATEGORIES,
  normalizeCompanyCategory,
  type CompanyCategorySlug,
} from "@/lib/companies/categories";
import type { Company, DocumentWithCompany, ReportWithCompany } from "@/types";
import type { DocumentProcessingRow } from "@/services/intelligence";
import type { DocumentProfileRow } from "@/lib/intelligence/profiles/types";

type CategorySummary = {
  slug: CompanyCategorySlug;
  label: string;
  count: number;
  latestAt: string | null;
  pendingCount: number;
  urgentCount: number;
  documentCount: number;
  reportCount: number;
  insights: string[];
};

export type CompanyWorkspace = {
  company: Company;
  summary: {
    documents: number;
    pending: number;
    reviewing: number;
    processed: number;
    reports: number;
    lastDocumentAt: string | null;
    lastReportAt: string | null;
    lastAnalysisAt: string | null;
    lastUpdatedAt: string | null;
  };
  categories: CategorySummary[];
  activity: {
    id: string;
    title: string;
    description: string;
    timestamp: string;
    href: string;
  }[];
};

export type CompanyCategoryDetail = {
  company: Company;
  category: { slug: CompanyCategorySlug; label: string };
  documents: DocumentWithCompany[];
  reports: ReportWithCompany[];
  processingBySourceId: Map<
    string,
    { status: string; processedAt: string | null }
  >;
};

export async function getAdminCompanyWorkspace(
  companyId: string,
): Promise<CompanyWorkspace | null> {
  const supabase = await createClient();
  const [
    companyRes,
    documentsRes,
    reportsRes,
    processingRes,
    notificationsRes,
    profilesRes,
  ] = await Promise.all([
    supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
    supabase
      .from("documents")
      .select("id,document_type,status,priority,created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("reports")
      .select("id,title,category,created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("document_processing")
      .select("id,document_id,report_id,status,processed_at,created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("id,title,description,href,created_at")
      .eq("audience", "admin")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("document_profiles")
      .select("document_type,period,structured_data,upload_date,created_at")
      .eq("company_id", companyId)
      .order("upload_date", { ascending: false })
      .limit(24),
  ]);
  if (companyRes.error) throw companyRes.error;
  if (!companyRes.data) return null;
  if (documentsRes.error) throw documentsRes.error;
  if (reportsRes.error) throw reportsRes.error;
  if (processingRes.error) throw processingRes.error;
  if (notificationsRes.error) throw notificationsRes.error;
  if (profilesRes.error) throw profilesRes.error;

  const documents = documentsRes.data ?? [];
  const reports = reportsRes.data ?? [];
  const processing = processingRes.data ?? [];
  const categoryMap = new Map<CompanyCategorySlug, CategorySummary>(
    COMPANY_CATEGORIES.map((category) => [
      category.slug,
      {
        ...category,
        count: 0,
        latestAt: null,
        pendingCount: 0,
        urgentCount: 0,
        documentCount: 0,
        reportCount: 0,
        insights: [],
      },
    ]),
  );
  for (const document of documents) {
    const category = categoryMap.get(
      normalizeCompanyCategory(document.document_type),
    )!;
    category.count += 1;
    category.documentCount += 1;
    if (["received", "reviewing"].includes(document.status))
      category.pendingCount += 1;
    if (document.priority === "urgent") category.urgentCount += 1;
    if (!category.latestAt || document.created_at > category.latestAt)
      category.latestAt = document.created_at;
  }
  for (const report of reports) {
    const category = categoryMap.get(
      normalizeCompanyCategory(`${report.category} ${report.title}`),
    )!;
    category.count += 1;
    category.reportCount += 1;
    if (!category.latestAt || report.created_at > category.latestAt)
      category.latestAt = report.created_at;
  }
  const seenInsight = new Set<CompanyCategorySlug>();
  const money = (value: unknown) =>
    typeof value === "number"
      ? new Intl.NumberFormat("es-US", {
          style: "currency",
          currency: "USD",
        }).format(value)
      : null;
  for (const profile of profilesRes.data ?? []) {
    const slug = normalizeCompanyCategory(profile.document_type ?? "other");
    if (seenInsight.has(slug)) continue;
    const data =
      profile.structured_data &&
      typeof profile.structured_data === "object" &&
      !Array.isArray(profile.structured_data)
        ? (profile.structured_data as Record<string, unknown>)
        : {};
    const insight = categoryMap.get(slug)?.insights;
    if (!insight) continue;
    if (profile.period) insight.push(`Periodo: ${profile.period}`);
    if (slug === "payroll") {
      const employees = data.employee_count ?? data.unique_employee_count;
      if (typeof employees === "number") insight.push(`${employees} empleados`);
      if (typeof data.total_hours === "number")
        insight.push(`${data.total_hours} horas`);
      const total = money(data.total_payroll);
      insight.push(
        total ? `Nómina: ${total}` : "Sin monto de nómina disponible",
      );
    } else if (slug === "accounts-receivable") {
      const total = money(data.total_receivable ?? data.grand_total);
      if (total) insight.push(`Por cobrar: ${total}`);
      if (typeof data.customer_count === "number")
        insight.push(`${data.customer_count} clientes`);
      if (typeof data.invoice_count === "number")
        insight.push(`${data.invoice_count} facturas`);
    } else if (slug === "accounts-payable") {
      const total = money(data.total_payable);
      if (total) insight.push(`Por pagar: ${total}`);
      if (typeof data.supplier_count === "number")
        insight.push(`${data.supplier_count} suplidores`);
      if (typeof data.invoice_count === "number")
        insight.push(`${data.invoice_count} facturas`);
    }
    if (insight.length) seenInsight.add(slug);
  }
  const dates = [
    documents[0]?.created_at,
    reports[0]?.created_at,
    processing[0]?.processed_at,
    processing[0]?.created_at,
  ].filter(Boolean) as string[];
  return {
    company: companyRes.data,
    summary: {
      documents: documents.length,
      pending: documents.filter((item) => item.status === "received").length,
      reviewing: documents.filter((item) => item.status === "reviewing").length,
      processed: documents.filter((item) => item.status === "processed").length,
      reports: reports.length,
      lastDocumentAt: documents[0]?.created_at ?? null,
      lastReportAt: reports[0]?.created_at ?? null,
      lastAnalysisAt:
        processing.find((item) => item.status === "completed")?.processed_at ??
        null,
      lastUpdatedAt: dates.sort().at(-1) ?? null,
    },
    categories: [...categoryMap.values()].filter(
      (category) => category.count > 0,
    ),
    activity: (notificationsRes.data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      timestamp: item.created_at,
      href: item.href,
    })),
  };
}

export async function getAdminCompanyCategoryDetail(
  companyId: string,
  categorySlug: string,
): Promise<CompanyCategoryDetail | null> {
  const category = COMPANY_CATEGORIES.find(
    (item) => item.slug === categorySlug,
  );
  if (!category) return null;
  const supabase = await createClient();
  const [companyRes, documentsRes, reportsRes, processingRes] =
    await Promise.all([
      supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
      supabase
        .from("documents")
        .select("*,company:companies(id,name)")
        .eq("company_id", companyId),
      supabase
        .from("reports")
        .select("*,company:companies(id,name)")
        .eq("company_id", companyId),
      supabase
        .from("document_processing")
        .select("document_id,report_id,status,processed_at")
        .eq("company_id", companyId),
    ]);
  if (companyRes.error) throw companyRes.error;
  if (!companyRes.data) return null;
  if (documentsRes.error) throw documentsRes.error;
  if (reportsRes.error) throw reportsRes.error;
  if (processingRes.error) throw processingRes.error;
  const documents = (documentsRes.data ?? []).filter(
    (item) => normalizeCompanyCategory(item.document_type) === category.slug,
  ) as DocumentWithCompany[];
  const reports = (reportsRes.data ?? []).filter(
    (item) =>
      normalizeCompanyCategory(`${item.category} ${item.title}`) ===
      category.slug,
  ) as ReportWithCompany[];
  documents.sort(
    (a, b) =>
      Number(b.priority === "urgent") - Number(a.priority === "urgent") ||
      Number(["received", "reviewing"].includes(b.status)) -
        Number(["received", "reviewing"].includes(a.status)) ||
      b.created_at.localeCompare(a.created_at),
  );
  reports.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const processingBySourceId = new Map<
    string,
    { status: string; processedAt: string | null }
  >();
  for (const row of processingRes.data ?? []) {
    const sourceId = row.document_id ?? row.report_id;
    if (sourceId)
      processingBySourceId.set(sourceId, {
        status: row.status,
        processedAt: row.processed_at,
      });
  }
  return {
    company: companyRes.data,
    category,
    documents,
    reports,
    processingBySourceId,
  };
}

export async function getAdminCompanyReportIntelligence(
  companyId: string,
  reportIds: string[],
) {
  const processing = new Map<string, DocumentProcessingRow>();
  const profiles = new Map<string, DocumentProfileRow>();
  if (!reportIds.length) return { processing, profiles };
  const supabase = await createClient();
  const [processingRes, profilesRes] = await Promise.all([
    supabase
      .from("document_processing")
      .select("*")
      .eq("company_id", companyId)
      .in("report_id", reportIds),
    supabase
      .from("document_profiles")
      .select("*")
      .eq("company_id", companyId)
      .in("report_id", reportIds),
  ]);
  if (processingRes.error) throw processingRes.error;
  if (profilesRes.error) throw profilesRes.error;
  for (const row of processingRes.data ?? []) {
    if (row.report_id)
      processing.set(row.report_id, row as DocumentProcessingRow);
  }
  for (const row of profilesRes.data ?? []) {
    if (row.report_id) profiles.set(row.report_id, row as DocumentProfileRow);
  }
  return { processing, profiles };
}
