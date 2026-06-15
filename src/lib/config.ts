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

  // ElevenLabs text-to-speech (optional). When ELEVENLABS_API_KEY is set, the
  // coach speaks with this cloud voice; otherwise it falls back to the
  // browser's built-in speech synthesis.
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default("RDWdsTU6N02BFftbIEAp"),
  ELEVENLABS_MODEL: z.string().default("eleven_turbo_v2_5"),

  // Rate limiting configuration (Phase 3 abuse prevention)
  RATE_LIMIT_ENABLED: z.enum(["true", "false"]).default("true"),
  RATE_LIMIT_MESSAGE_PER_MIN: z.coerce
    .number()
    .int()
    .positive()
    .default(20),
  RATE_LIMIT_SESSION_PER_HOUR: z.coerce
    .number()
    .int()
    .positive()
    .default(10),
  RATE_LIMIT_IP_PER_HOUR: z.coerce
    .number()
    .int()
    .positive()
    .default(100),

  // Phase 4: Performance Optimization
  DATABASE_URL_POOL_SIZE: z.coerce.number().int().min(2).max(20).default(10),
  RAG_CACHE_TTL: z.coerce.number().int().positive().default(1800), // 30 minutes
  RAG_TIMEOUT: z.coerce.number().int().positive().default(2000), // 2 seconds
  MAX_MESSAGE_HISTORY: z.coerce.number().int().min(10).max(30).default(30),
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
