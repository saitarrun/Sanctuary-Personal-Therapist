import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { embedQuery } from "./embeddings";

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
 * Embeds the query and returns the top-k most similar chunks via pgvector cosine
 * distance (the HNSW index backs the `<=>` ordering). Degrades gracefully to an
 * empty array if the corpus is empty or retrieval fails — the coach then answers
 * from general competence rather than erroring the turn.
 */
export async function retrieve(
  query: string,
  k?: number
): Promise<RetrievedChunk[]> {
  const topK = k ?? getConfig().RAG_TOP_K;
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    const vec = await embedQuery(trimmed);
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
    return rows;
  } catch (err) {
    console.error("[retrieve] retrieval failed, continuing without context:", err);
    return [];
  }
}

/**
 * Formats retrieved chunks into a single reference block for the system prompt.
 * Numbered for the model's own bookkeeping only — the prompt forbids reading
 * these aloud.
 */
export function formatReferenceBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join("\n\n");
}
