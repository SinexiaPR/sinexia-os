"use server";

import { assistantConfig } from "@/config/assistant";
import { requireClient } from "@/lib/auth/session";
import { getDocumentHistory } from "@/lib/intelligence/profiles/store";
import { answerWithRetrieval } from "@/lib/intelligence/retrieval";
import { getAvailableTrendSummaries } from "@/lib/intelligence/trends";
import { createClient } from "@/lib/supabase/server";
import {
  buildSuggestedQuestionsFromProfiles,
  getProfilesForCompanySuggestions,
} from "@/services/intelligence";

export type SinexIAChatResult = {
  message: string;
  disclaimer: string;
  sources: Array<{
    reportId?: string;
    title: string;
    period: string | null;
    pageNumber?: number | null;
    sheetName?: string | null;
    viewPath?: string;
    downloadPath?: string;
  }>;
};

export async function askSinexIA(params: {
  message: string;
  conversationId?: string | null;
  reportId?: string | null;
  category?: string | null;
  period?: string | null;
}): Promise<{ data?: SinexIAChatResult; error?: string }> {
  const trimmed = params.message.trim();
  if (!trimmed) {
    return { error: "Escriba una pregunta para continuar." };
  }

  const profile = await requireClient();
  if (!profile.company_id) {
    return { error: "Su cuenta no está vinculada a una empresa." };
  }

  const supabase = await createClient();

  let conversationId = params.conversationId ?? null;

  if (!conversationId) {
    const title = trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
    const { data: conversation, error } = await supabase
      .from("sinexia_conversations")
      .insert({
        company_id: profile.company_id,
        user_id: profile.id,
        title,
      })
      .select("id")
      .single();

    if (error || !conversation) {
      return { error: "No se pudo iniciar la conversación." };
    }
    conversationId = conversation.id;
  }

  await supabase.from("sinexia_messages").insert({
    conversation_id: conversationId,
    company_id: profile.company_id,
    role: "user",
    content: trimmed,
  });

  try {
    const answer = await answerWithRetrieval({
      question: trimmed,
      filters: {
        companyId: profile.company_id,
        reportId: params.reportId,
        category: params.category,
        period: params.period,
        userId: profile.id,
      },
      diagnostics: {
        userId: profile.id,
        log: true,
      },
    });

    await supabase.from("sinexia_messages").insert({
      conversation_id: conversationId,
      company_id: profile.company_id,
      role: "assistant",
      content: answer.message,
      source_references: answer.sources,
    });

    return {
      data: {
        message: answer.message,
        disclaimer: assistantConfig.disclaimer,
        sources: answer.sources,
      },
    };
  } catch (error) {
    console.error("[askSinexIA]", error);
    return {
      error: "SinexIA no pudo responder en este momento. Intente de nuevo.",
    };
  }
}

/** @deprecated Use askSinexIA */
export async function askSia(message: string) {
  return askSinexIA({ message });
}

export async function getSinexIASuggestions() {
  const profile = await requireClient();
  if (!profile.company_id) {
    return {
      suggestions: assistantConfig.suggestedPrompts as unknown as string[],
    };
  }

  const supabase = await createClient();
  const [{ data: company }, profiles] = await Promise.all([
    supabase
      .from("companies")
      .select("slug")
      .eq("id", profile.company_id)
      .maybeSingle(),
    getProfilesForCompanySuggestions(profile.company_id),
  ]);
  if (company?.slug === "tresbe") {
    return {
      suggestions: [
        "¿Cuál fue el total general de la última nómina?",
        "¿Quién trabajó más horas?",
        "¿Quién recibió cheques de servicios?",
        "¿Cuál fue el total de propinas?",
      ],
    };
  }
  return {
    suggestions: buildSuggestedQuestionsFromProfiles(
      profiles.map((p) => ({
        document_type: p.document_type,
        period: p.period,
        structured_data: p.structured_data as Record<string, unknown>,
      })),
    ),
  };
}

export async function getSinexIADocumentHistory() {
  const profile = await requireClient();
  if (!profile.company_id) {
    return { history: [] };
  }

  const history = await getDocumentHistory(profile.company_id, 10);
  return {
    history: history.map((row) => {
      const proc = row.document_processing as {
        processed_at?: string | null;
        reports?: { title?: string; category?: string } | null;
        documents?: { supplier?: string; document_type?: string } | null;
      } | null;

      return {
        id: row.id as string,
        documentType: row.document_type as string | null,
        period: row.period as string | null,
        summary: row.summary as string | null,
        confidence: row.extraction_confidence as number | null,
        uploadDate: row.upload_date as string | null,
        reportId: row.report_id as string | null,
        title:
          proc?.reports?.title ??
          (proc?.documents
            ? `${proc.documents.document_type} · ${proc.documents.supplier}`
            : "Documento"),
      };
    }),
  };
}

export async function getSinexIATrends() {
  const profile = await requireClient();
  if (!profile.company_id) {
    return { trends: [] };
  }

  const trends = await getAvailableTrendSummaries(profile.company_id);
  return { trends };
}
