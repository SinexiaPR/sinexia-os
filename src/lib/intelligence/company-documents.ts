import { createClient } from "@/lib/supabase/server";

export type CompanySinexiaState = {
  completedCount: number;
  profileCount: number;
  requiresOcrCount: number;
  pendingCount: number;
  failedCount: number;
  scopedReportStatus: string | null;
  scopedReportType: string | null;
  scopedReportCategory: string | null;
};

export async function getCompanySinexiaState(
  companyId: string,
  reportId?: string | null,
): Promise<CompanySinexiaState> {
  const supabase = await createClient();

  let query = supabase
    .from("document_processing")
    .select(
      "id, status, detected_document_type, report_id, reports(category)",
    )
    .eq("company_id", companyId);

  if (reportId) {
    query = query.eq("report_id", reportId);
  }

  const { data: rows } = await query;

  const state: CompanySinexiaState = {
    completedCount: 0,
    profileCount: 0,
    requiresOcrCount: 0,
    pendingCount: 0,
    failedCount: 0,
    scopedReportStatus: null,
    scopedReportType: null,
    scopedReportCategory: null,
  };

  for (const row of rows ?? []) {
    switch (row.status) {
      case "completed":
        state.completedCount += 1;
        break;
      case "requires_ocr":
        state.requiresOcrCount += 1;
        break;
      case "failed":
        state.failedCount += 1;
        break;
      default:
        state.pendingCount += 1;
        break;
    }

    if (reportId && row.report_id === reportId) {
      state.scopedReportStatus = row.status;
      state.scopedReportType = row.detected_document_type;
      const report = row.reports as { category?: string } | null;
      state.scopedReportCategory = report?.category ?? null;
    }
  }

  if (state.completedCount > 0) {
    const completedIds = (rows ?? [])
      .filter((r) => r.status === "completed")
      .map((r) => r.id);

    const { count } = await supabase
      .from("document_profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("document_processing_id", completedIds);

    state.profileCount = count ?? 0;
  }

  return state;
}

export function logSinexiaRetrievalDiagnostics(params: {
  userId: string;
  companyId: string;
  reportId?: string | null;
  state: CompanySinexiaState;
  profileCount?: number;
  chunkCount?: number;
}) {
  console.info("[sinexia-retrieval]", {
    userId: params.userId,
    companyId: params.companyId,
    reportId: params.reportId ?? null,
    processingCompleted: params.state.completedCount,
    profiles: params.profileCount ?? params.state.profileCount,
    chunks: params.chunkCount ?? null,
    requiresOcr: params.state.requiresOcrCount,
    pending: params.state.pendingCount,
    failed: params.state.failedCount,
    scopedStatus: params.state.scopedReportStatus,
    scopedType: params.state.scopedReportType,
    scopedCategory: params.state.scopedReportCategory,
  });
}

export type IntegrityIssue = {
  kind: string;
  detail: string;
  entityId?: string;
};

export async function runCompanyIntegrityCheck(): Promise<IntegrityIssue[]> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  let admin;

  try {
    admin = createAdminClient();
  } catch {
    return [{ kind: "config", detail: "Service role not configured." }];
  }

  const issues: IntegrityIssue[] = [];

  const { data: authUsers } = await admin.auth.admin.listUsers({
    perPage: 200,
  });

  const { data: profiles } = await admin.from("profiles").select("*");
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  for (const user of authUsers?.users ?? []) {
    const profile = profileById.get(user.id);
    if (!profile) {
      issues.push({
        kind: "missing_profile",
        detail: `Auth user without profile: ${user.email}`,
        entityId: user.id,
      });
      continue;
    }

    if (profile.role === "client" && !profile.company_id) {
      issues.push({
        kind: "client_without_company",
        detail: `Client profile missing company_id: ${profile.email}`,
        entityId: profile.id,
      });
    }
  }

  const { data: reports } = await admin
    .from("reports")
    .select("id, company_id, title");

  for (const report of reports ?? []) {
    if (!report.company_id) {
      issues.push({
        kind: "report_missing_company",
        detail: `Report without company_id: ${report.title}`,
        entityId: report.id,
      });
    }
  }

  const { data: processing } = await admin
    .from("document_processing")
    .select("id, company_id, report_id, status, reports(company_id, title)");

  for (const row of processing ?? []) {
    if (!row.company_id) {
      issues.push({
        kind: "processing_missing_company",
        detail: `Processing row missing company_id`,
        entityId: row.id,
      });
    }

    const report = row.reports as {
      company_id?: string;
      title?: string;
    } | null;

    if (
      row.report_id &&
      report?.company_id &&
      row.company_id !== report.company_id
    ) {
      issues.push({
        kind: "processing_company_mismatch",
        detail: `Processing company_id differs from report for «${report.title ?? row.report_id}»`,
        entityId: row.id,
      });
    }

    if (row.status === "completed" && row.report_id) {
      const { data: profile } = await admin
        .from("document_profiles")
        .select("id")
        .eq("document_processing_id", row.id)
        .maybeSingle();

      if (!profile) {
        issues.push({
          kind: "completed_without_profile",
          detail: `Completed processing without structured profile: ${report?.title ?? row.report_id}`,
          entityId: row.id,
        });
      }
    }
  }

  const { data: docProfiles } = await admin
    .from("document_profiles")
    .select("id, company_id, document_processing_id");

  for (const profile of docProfiles ?? []) {
    if (!profile.company_id) {
      issues.push({
        kind: "profile_missing_company",
        detail: "Document profile missing company_id",
        entityId: profile.id,
      });
    }
  }

  const { data: chunks } = await admin
    .from("document_chunks")
    .select("id, company_id")
    .limit(500);

  for (const chunk of chunks ?? []) {
    if (!chunk.company_id) {
      issues.push({
        kind: "chunk_missing_company",
        detail: "Document chunk missing company_id",
        entityId: chunk.id,
      });
    }
  }

  return issues;
}
