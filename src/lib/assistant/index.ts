import { SampleAssistantProvider } from "@/lib/assistant/providers/sample-provider";
import type { AssistantProvider } from "@/lib/assistant/types";

// Future: swap to OpenAiAssistantProvider when OPENAI_API_KEY is configured.
export function getAssistantProvider(): AssistantProvider {
  return new SampleAssistantProvider();
}

export type { AssistantContext, AssistantMessage, AssistantResponse } from "@/lib/assistant/types";
