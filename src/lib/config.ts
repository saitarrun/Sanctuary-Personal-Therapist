import { z } from "zod";

/**
 * Typed, validated access to environment variables. Imported only on the server.
 * Throws early (at first access) if something required is malformed.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  LLM_PROVIDER: z.enum(["openrouter", "claude-cli"]).default("openrouter"),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("anthropic/claude-sonnet-4.6"),
  OPENROUTER_APP_URL: z.string().default("http://localhost:3000"),
  OPENROUTER_APP_NAME: z.string().default("Personal Psychologist"),

  CLAUDE_CLI_MODEL: z.string().default("sonnet"),

  EMBEDDING_MODEL: z.string().default("Xenova/bge-small-en-v1.5"),
  RAG_TOP_K: z.coerce.number().int().positive().default(6),
});

let cached: z.infer<typeof schema> | null = null;

export function getConfig() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Embedding dimension the schema's vector(N) column expects. */
export const EMBEDDING_DIM = 384;
