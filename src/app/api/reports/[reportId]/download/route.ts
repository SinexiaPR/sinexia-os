import { NextResponse } from "next/server";

import { getProfile } from "@/lib/auth/session";
import { REPORTS_BUCKET } from "@/lib/constants/reports";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ reportId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reportId } = await context.params;
  const supabase = await createClient();

  const { data: report, error } = await supabase
    .from("reports")
    .select("id, company_id, file_url, title")
    .eq("id", reportId)
    .maybeSingle();

  if (error || !report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    profile.role === "client" &&
    profile.company_id !== report.company_id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(report.file_url, 120);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "Unable to create download link" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
