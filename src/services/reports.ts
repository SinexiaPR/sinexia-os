import { REPORTS_BUCKET } from "@/lib/constants/reports";
import { createClient } from "@/lib/supabase/server";
import type { Report, ReportWithCompany } from "@/types";

export async function getSignedReportFileUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function getReportsForCompany(
  companyId: string,
): Promise<ReportWithCompany[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .select("*, company:companies(id, name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ReportWithCompany[];
}

export async function getAllReports(): Promise<ReportWithCompany[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .select("*, company:companies(id, name)")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ReportWithCompany[];
}

export async function getLatestReportForCompany(
  companyId: string,
): Promise<ReportWithCompany | null> {
  const reports = await getReportsForCompany(companyId);
  return reports[0] ?? null;
}

export async function getReportCreatedDatesForCompany(
  companyId: string,
): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .select("created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((report) => report.created_at);
}

export async function getReportSummariesForCompany(
  companyId: string,
): Promise<{ id: string; created_at: string }[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .select("id, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getRecentReports(
  limit = 8,
): Promise<ReportWithCompany[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .select("*, company:companies(id, name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as ReportWithCompany[];
}

export async function getReportById(
  reportId: string,
): Promise<Report | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
