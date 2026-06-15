export interface ChunkOptions {
  /** Approx. target chunk size in tokens (~4 chars/token heuristic). */
  targetTokens?: number;
  /** Approx. token overlap between consecutive chunks. */
  overlapTokens?: number;
}

const CHARS_PER_TOKEN = 4;

/**
 * Splits long text into overlapping chunks for embedding. Token counts are
 * approximated by characters (~4 chars/token) to avoid a tokenizer dependency in
 * the hot path; the boundaries land on whitespace so words aren't cut.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const targetTokens = opts.targetTokens ?? 500;
  const overlapTokens = opts.overlapTokens ?? 50;

  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const targetChars = targetTokens * CHARS_PER_TOKEN;
  const overlapChars = Math.min(overlapTokens * CHARS_PER_TOKEN, targetChars - 1);
  const stride = Math.max(1, targetChars - overlapChars);

  if (normalized.length <= targetChars) return [normalized];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + targetChars, normalized.length);
    // Prefer to break on a space near the end so we don't split a word.
    if (end < normalized.length) {
      const lastSpace = normalized.lastIndexOf(" ", end);
      if (lastSpace > start + stride / 2) end = lastSpace;
    }
    const piece = normalized.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= normalized.length) break;
    start = end - overlapChars;
  }
  return chunks;
}
