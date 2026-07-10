import { INTELLIGENCE_LIMITS } from "@/lib/intelligence/constants";
import {
  createEmbeddings,
  isOpenAIConfigured,
} from "@/lib/intelligence/providers/openai";
import type { ExtractedChunk } from "@/lib/intelligence/types";

export type ChunkWithEmbedding = ExtractedChunk & {
  embedding: number[] | null;
};

export async function embedChunks(
  chunks: ExtractedChunk[],
): Promise<{ chunks: ChunkWithEmbedding[]; tokenUsage: number }> {
  if (!chunks.length) {
    return { chunks: [], tokenUsage: 0 };
  }

  if (!isOpenAIConfigured()) {
    return {
      chunks: chunks.map((c) => ({ ...c, embedding: null })),
      tokenUsage: 0,
    };
  }

  const limited = chunks.slice(0, INTELLIGENCE_LIMITS.maxChunksPerDocument);
  const embeddings: number[][] = [];
  let tokenUsage = 0;
  const batchSize = INTELLIGENCE_LIMITS.embeddingBatchSize;

  for (let i = 0; i < limited.length; i += batchSize) {
    const batch = limited.slice(i, i + batchSize);
    const result = await createEmbeddings(batch.map((c) => c.content));
    embeddings.push(...result.embeddings);
    tokenUsage += result.usage.totalTokens;
  }

  return {
    chunks: limited.map((c, idx) => ({
      ...c,
      embedding: embeddings[idx] ?? null,
    })),
    tokenUsage,
  };
}
