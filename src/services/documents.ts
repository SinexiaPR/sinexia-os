import { createClient } from "@/lib/supabase/server";
import type { Company, CompanyWithStats, DocumentWithCompany } from "@/types";
import { PENDING_STATUSES } from "@/types";

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

export async function getAllDocuments(): Promise<DocumentWithCompany[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("*, company:companies(id, name)")
    .order("created_at", { ascending: false });

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

export async function countDocumentsReceivedToday(): Promise<number> {
  const supabase = await createClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .gte("created_at", start.toISOString());

  if (error) {
    throw error;
  }

  return count ?? 0;
}
