import type {
  AssistantContext,
  AssistantProvider,
  AssistantResponse,
} from "@/lib/assistant/types";

/**
 * Placeholder for future OpenAI integration.
 * Enable by setting OPENAI_API_KEY and switching the provider factory.
 */
export class OpenAiAssistantProvider implements AssistantProvider {
  async generate(
    _input: string,
    _context: AssistantContext,
  ): Promise<AssistantResponse> {
    throw new Error(
      "OpenAI integration is not configured yet. Using the sample assistant.",
    );
  }
}
