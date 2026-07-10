"use server";

import { requireAdmin } from "@/lib/auth/session";
import {
  runCompanyIntegrityCheck,
  type IntegrityIssue,
} from "@/lib/intelligence/company-documents";

export async function getSinexiaIntegrityReport(): Promise<{
  issues: IntegrityIssue[];
  error?: string;
}> {
  await requireAdmin();

  try {
    const issues = await runCompanyIntegrityCheck();
    return { issues };
  } catch (error) {
    console.error("[getSinexiaIntegrityReport]", error);
    return {
      issues: [],
      error: "No se pudo ejecutar la verificación de integridad.",
    };
  }
}
