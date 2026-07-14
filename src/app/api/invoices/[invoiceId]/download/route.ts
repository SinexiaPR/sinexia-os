import { NextResponse } from "next/server";

import { getProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  const profile = await getProfile();
  if (!profile)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { invoiceId } = await context.params;
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id,company_id,status,pdf_storage_path")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice || !invoice.pdf_storage_path)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (profile.role === "client" && profile.company_id !== invoice.company_id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (profile.role === "client" && invoice.status === "draft")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("invoices")
    .createSignedUrl(invoice.pdf_storage_path, 120);
  if (error || !data?.signedUrl)
    return NextResponse.json(
      { error: "Unable to create download link" },
      { status: 500 },
    );
  return NextResponse.redirect(data.signedUrl);
}
