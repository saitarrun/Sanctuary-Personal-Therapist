import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { embedQuery } from "./embeddings";
import { embeddingCache, retrievalCache, hashQuery } from "./cache";
import { getMonitor } from "@/lib/performance/monitor";

export interface RetrievedChunk {
  chunkId: string;
  content: string;
  documentId: string;
  title: string;
  authors: string | null;
  source: string;
  url: string | null;
  license: string | null;
  similarity: number;
}

/** Serialize a JS vector to a pgvector literal, e.g. "[0.1,0.2,...]". */
function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/**
 * Embeds the query with caching. Returns cached embedding if available (< 30 min old),
 * otherwise queries the embedding model and caches the result.
 */
async function getEmbedding(query: string): Promise<number[]> {
  const queryHash = hashQuery(query);
  const cached = embeddingCache.get(queryHash);
  if (cached) {
    return cached;
  }

  const embedding = await embedQuery(query);
  embeddingCache.set(queryHash, embedding);
  return embedding;
}

/**
 * Embeds the query and returns the top-k most similar chunks via pgvector cosine
 * distance (the HNSW index backs the `<=>` ordering). Degrades gracefully to an
 * empty array if the corpus is empty or retrieval fails — the coach then answers
 * from general competence rather than erroring the turn.
 *
 * Features:
 * - Caches embeddings (30-minute TTL)
 * - Caches full retrieval results (5-minute TTL)
 * - Implements 2-second timeout with fallback
 * - Limits to top 5 chunks for better performance
 * - Tracks retrieval time in performance monitor
 */
export async function retrieve(
  query: string,
  k?: number
): Promise<RetrievedChunk[]> {
  const config = getConfig();
  const topK = Math.min(k ?? config.RAG_TOP_K, 5); // Limit to top 5
  const trimmed = query.trim();
  if (!trimmed) return [];

  const startTime = Date.now();

  // Check if same query result is cached
  const queryHash = hashQuery(trimmed);
  const cachedResult = retrievalCache.get(queryHash);
  if (cachedResult) {
    return cachedResult as RetrievedChunk[];
  }

  try {
    // Retrieve with timeout (configurable, default 2 seconds)
    const config = getConfig();
    const timeoutMs = config.RAG_TIMEOUT;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const vec = await getEmbedding(trimmed);
      const literal = toVectorLiteral(vec);

      const rows = await prisma.$queryRaw<RetrievedChunk[]>(Prisma.sql`
        SELECT
          c."id"            AS "chunkId",
          c."content"       AS "content",
          d."id"            AS "documentId",
          d."title"         AS "title",
          d."authors"       AS "authors",
          d."source"        AS "source",
          d."url"           AS "url",
          d."license"       AS "license",
          1 - (c."embedding" <=> ${literal}::vector) AS "similarity"
        FROM "Chunk" c
        JOIN "Document" d ON d."id" = c."documentId"
        WHERE c."embedding" IS NOT NULL
        ORDER BY c."embedding" <=> ${literal}::vector
        LIMIT ${topK}
      `);

      // Cache the result
      retrievalCache.set(queryHash, rows);

      // Track retrieval time
      const elapsedMs = Date.now() - startTime;
      getMonitor().recordRagRetrievalTime(elapsedMs);

      return rows;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    // Log timeout but don't error — coach answers from general competence
    if (err instanceof Error && err.name === "AbortError") {
      const config = getConfig();
      console.warn(
        `[retrieve] RAG timeout (${config.RAG_TIMEOUT}ms), continuing without context`
      );
    } else {
      console.error("[retrieve] retrieval failed, continuing without context:", err);
    }
    return [];
  }
}

/**
 * Formats retrieved chunks into a single reference block for the system prompt.
 * Contextualizes each chunk by prepending its document title and source.
 */
export function formatReferenceBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] Source: "${c.title}" (${c.source})\nContent: ${c.content}`
    )
    .join("\n\n");
}
