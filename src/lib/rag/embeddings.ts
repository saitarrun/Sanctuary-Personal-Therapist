import { getConfig, EMBEDDING_DIM } from "@/lib/config";

// transformers.js types are loose; we lazy-import to keep it off the client and
// out of cold-start paths that don't need it.
type FeatureExtractionPipeline = (
  input: string | string[],
  opts?: { pooling?: "mean" | "cls" | "none"; normalize?: boolean }
) => Promise<{ tolist: () => number[][] | number[][][] }>;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      // The model is downloaded + cached to disk. On serverless (Vercel) only
      // /tmp is writable, so point the cache there; honor an explicit override.
      const cacheDir =
        process.env.TRANSFORMERS_CACHE ??
        (process.env.VERCEL ? "/tmp/hf-cache" : undefined);
      if (cacheDir) env.cacheDir = cacheDir;
      const model = getConfig().EMBEDDING_MODEL;
      return (await pipeline(
        "feature-extraction",
        model
      )) as unknown as FeatureExtractionPipeline;
    })();
  }
  return pipelinePromise;
}

/**
 * bge-style models benefit from a short instruction prefix on the QUERY side
 * only. Documents are embedded as-is.
 */
function withQueryPrefix(text: string): string {
  return `Represent this sentence for searching relevant passages: ${text}`;
}

function assertDim(vec: number[]): number[] {
  if (vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `Embedding dimension ${vec.length} != expected ${EMBEDDING_DIM}. ` +
        `Check EMBEDDING_MODEL and the vector(N) column.`
    );
  }
  return vec;
}

/** Embed a single document/passage. */
export async function embed(text: string): Promise<number[]> {
  const [vec] = await embedBatch([text]);
  return vec;
}

/** Embed many passages in one call (used by the ingestion pipeline). */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const pipe = await getPipeline();
  const out = await pipe(texts, { pooling: "mean", normalize: true });
  const rows = out.tolist() as number[][];
  return rows.map(assertDim);
}

/** Embed a search query (applies the query-side prefix). */
export async function embedQuery(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const out = await pipe([withQueryPrefix(text)], {
    pooling: "mean",
    normalize: true,
  });
  const [vec] = out.tolist() as number[][];
  return assertDim(vec);
}
