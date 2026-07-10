import { createHash } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeQuestionForCache } from "@/lib/intelligence/intents";

const DEFAULT_TTL_DAYS = 30;

export function buildGptCacheKey(params: {
  companyId: string;
  question: string;
  processingId?: string | null;
  scope?: string;
}): string {
  const normalized = normalizeQuestionForCache(params.question);
  const raw = [
    params.companyId,
    params.processingId ?? "all",
    params.scope ?? "chat",
    normalized,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex");
}

export async function getCachedGptResponse(params: {
  admin: SupabaseClient;
  cacheKey: string;
}): Promise<string | null> {
  const { data } = await params.admin
    .from("sinexia_gpt_cache")
    .select("response, expires_at")
    .eq("cache_key", params.cacheKey)
    .maybeSingle();

  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }
  return data.response;
}

export async function setCachedGptResponse(params: {
  admin: SupabaseClient;
  cacheKey: string;
  companyId: string;
  question: string;
  response: string;
  modelName?: string | null;
  processingId?: string | null;
}): Promise<void> {
  const expires = new Date();
  expires.setDate(expires.getDate() + DEFAULT_TTL_DAYS);

  await params.admin.from("sinexia_gpt_cache").upsert(
    {
      cache_key: params.cacheKey,
      company_id: params.companyId,
      document_processing_id: params.processingId ?? null,
      question_normalized: normalizeQuestionForCache(params.question),
      response: params.response,
      model_name: params.modelName ?? null,
      expires_at: expires.toISOString(),
    },
    { onConflict: "cache_key" },
  );
}
