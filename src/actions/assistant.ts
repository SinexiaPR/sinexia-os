"use server";

import { getAssistantProvider } from "@/lib/assistant";
import { requireClient } from "@/lib/auth/session";
import { buildAssistantContext } from "@/services/assistant-context";

export async function askSia(message: string) {
  const trimmed = message.trim();

  if (!trimmed) {
    return { error: "Escriba una pregunta para continuar." };
  }

  const profile = await requireClient();
  const context = await buildAssistantContext(profile);
  const response = await getAssistantProvider().generate(trimmed, context);

  return { data: response };
}
