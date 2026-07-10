"use server";

import { askSinexIA } from "@/actions/sinexia-chat";

/** @deprecated Prefer askSinexIA from @/actions/sinexia-chat */
export async function askSia(message: string) {
  const result = await askSinexIA({ message });
  if (result.error) {
    return { error: result.error };
  }
  return {
    data: result.data
      ? {
          message: result.data.message,
          disclaimer: result.data.disclaimer,
        }
      : undefined,
  };
}
