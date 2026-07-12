import { createClient } from "@/lib/supabase/server";
import type { Company, CompanyWithStats, DocumentWithCompany } from "@/types";
import { PENDING_STATUSES } from "@/types";

export type AdminDocumentFiltersValue = {
  company?: string;
  documentType?: string;
  priority?: string;
  status?: string;
  uploadDate?: string;
};

export async function getSignedFileUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function getCompanies(): Promise<Company[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("name");

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getCompaniesWithStats(): Promise<CompanyWithStats[]> {
  const supabase = await createClient();
  const companies = await getCompanies();

  const { data: documents, error } = await supabase
    .from("documents")
    .select("company_id, status");

  if (error) {
    throw error;
  }

  return companies.map((company) => {
    const companyDocs = (documents ?? []).filter(
      (doc) => doc.company_id === company.id,
    );

    return {
      ...company,
      pending_count: companyDocs.filter((doc) =>
        PENDING_STATUSES.includes(doc.status),
      ).length,
      total_documents: companyDocs.length,
    };
  });
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getRecentDocuments(
  limit = 8,
): Promise<DocumentWithCompany[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("*, company:companies(id, name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as DocumentWithCompany[];
}

export async function getDocumentsForCompany(
  companyId: string,
): Promise<DocumentWithCompany[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("*, company:companies(id, name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as DocumentWithCompany[];
}

export async function getAllDocuments(
  filters: AdminDocumentFiltersValue = {},
): Promise<DocumentWithCompany[]> {
  const supabase = await createClient();

  let query = supabase
    .from("documents")
    .select("*, company:companies(id, name)")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.company) query = query.eq("company_id", filters.company);
  if (filters.documentType)
    query = query.eq("document_type", filters.documentType);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.uploadDate) {
    const start = `${filters.uploadDate}T00:00:00.000Z`;
    const endDate = new Date(start);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    query = query
      .gte("created_at", start)
      .lt("created_at", endDate.toISOString());
  }

  const { data, error } = await query;

  if (
    error &&
    (error.code === "42703" ||
      error.code === "PGRST204" ||
      error.message.includes("priority"))
  ) {
    let legacyQuery = supabase
      .from("documents")
      .select("*, company:companies(id, name)")
      .order("created_at", { ascending: false });

    if (filters.company)
      legacyQuery = legacyQuery.eq("company_id", filters.company);
    if (filters.documentType)
      legacyQuery = legacyQuery.eq("document_type", filters.documentType);
    if (filters.status) legacyQuery = legacyQuery.eq("status", filters.status);
    if (filters.uploadDate) {
      const start = `${filters.uploadDate}T00:00:00.000Z`;
      const endDate = new Date(start);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      legacyQuery = legacyQuery
        .gte("created_at", start)
        .lt("created_at", endDate.toISOString());
    }

    const { data: legacyData, error: legacyError } = await legacyQuery;

    if (legacyError) throw legacyError;
    return (legacyData ?? []) as DocumentWithCompany[];
  }

  if (error) {
    throw error;
  }

  return (data ?? []) as DocumentWithCompany[];
}

export async function countPendingDocuments(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .in("status", PENDING_STATUSES);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function countPendingDocumentsForCompany(
  companyId: string,
): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("status", PENDING_STATUSES);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
