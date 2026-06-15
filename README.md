# Personal Psychologist

A voice-driven, knowledge-grounded AI coaching companion. You **speak**, it
listens, thinks, and **speaks back** — a real-time, face-to-face style
conversation with a solution-focused coach. Answers are grounded in a corpus of
open-access psychology literature via retrieval-augmented generation (RAG).

> ⚠️ This is a supportive coaching tool, **not** a licensed therapist, medical
> service, or crisis line. It does not diagnose or treat. If you are in danger or
> crisis, contact local emergency services or a crisis line.

## Features

- **Voice-only loop** — browser-native speech recognition + synthesis (Web Speech
  API). No extra API keys for voice; works best in **Google Chrome** on desktop.
- **Animated presence orb** that reacts to listening / thinking / speaking.
- **Solution-focused coaching** system prompt tuned for spoken delivery.
- **RAG grounding** — open-access psychology sources are ingested, embedded
  locally (free, private), indexed in Postgres + `pgvector`, and retrieved per
  turn. Sources inform answers **silently** (a small on-screen panel lists them).
- **Crisis safety** — prompt-level guidance plus a server-side heuristic that
  surfaces hotline resources.
- **Pluggable LLM backend** — OpenRouter (default, deployable) or the local
  Claude Code CLI, selected with one env var.
- **Server-side persistence** of sessions and messages.

## Architecture

```
Browser (voice)                 Next.js server
─────────────────               ─────────────────────────────────────────
SpeechRecognition  ─ transcript ─▶ /api/chat
                                     ├─ detectCrisis()                (safety net)
                                     ├─ retrieve()  → pgvector top-k  (grounding)
                                     ├─ buildSystemPrompt()
                                     ├─ getProvider().chat()          (OpenRouter | claude-cli)
                                     └─ persist messages + sources
SpeechSynthesis    ◀─ reply text ──┘
```

## Prerequisites

- Node.js 20+ and npm
- Docker (for local Postgres + pgvector) — or any Postgres with the `vector`
  extension (e.g. Neon)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    Edit .env: set OPENROUTER_API_KEY (or LLM_PROVIDER=claude-cli for local dev)

# 3. Start Postgres + pgvector
docker compose up -d

# 4. Create the schema (extension + tables + HNSW index)
npx prisma migrate dev --name init

# 5. Run
npm run dev      # http://localhost:3000  (open in Chrome, allow microphone)
```

### LLM backend

Set `LLM_PROVIDER` in `.env`:

- `openrouter` (default) — needs `OPENROUTER_API_KEY`. Works when deployed.
  Confirm the live model slug with
  `curl https://openrouter.ai/api/v1/models -H "Authorization: Bearer $OPENROUTER_API_KEY"`
  and set `OPENROUTER_MODEL` accordingly (default `anthropic/claude-sonnet-4.6`).
- `claude-cli` — shells out to your local, authenticated Claude Code CLI
  (`claude -p`). **Local development only**; does not work on Vercel/serverless.

## Ingesting the knowledge base

The coach is far more useful once the corpus is populated. The ingestion CLI
fetches **open-access** material, chunks it, embeds it locally, and stores it.

```bash
# Open-access journal full text / abstracts
npm run ingest -- --source europepmc --query "cognitive behavioral therapy" --limit 25
npm run ingest -- --source doaj --query "anxiety coping strategies" --limit 50

# University research output (open access, via OpenAlex)
npm run ingest -- --source harvard --query "wellbeing" --limit 50
npm run ingest -- --source stanford --query "anxiety" --limit 50

# Curated open-access psychology journals, and the psychology subject as a whole
npm run ingest -- --source journals --query "emotion regulation" --limit 100
npm run ingest -- --source psychology --query "resilience" --limit 100

# Your own CC-licensed textbooks/PDFs: drop files in ./corpus/ then:
npm run ingest -- --source openTextbook
```

### Available sources

| Source | What it pulls |
| --- | --- |
| `europepmc` | Open-access full text / abstracts from Europe PMC / PubMed Central |
| `doaj` | Article metadata + abstracts from the Directory of Open Access Journals |
| `harvard` | Open-access research authored at Harvard (via OpenAlex) |
| `stanford` | Open-access research authored at Stanford (via OpenAlex) |
| `journals` | A curated set of reputable open-access psychology journals (see `src/lib/rag/sources/journals.ts`) |
| `psychology` | Open-access works under the OpenAlex "Psychology" subject |
| `openTextbook` | CC-licensed files you place in `./corpus/` (PDF/TXT/MD/HTML) |

Flags: `--source`, `--query`, `--limit`, `--dry-run`. Ingestion is idempotent
(documents upsert on `source` + `externalId`). The first run downloads the local
embedding model (~tens of MB).

The OpenAlex-backed sources (`harvard`, `stanford`, `journals`, `psychology`)
index titles + abstracts by default. Set `OPENALEX_FULLTEXT=1` to also best-effort
fetch open-access PDFs (slower), and `OPENALEX_MAILTO` to your email to use
OpenAlex's faster "polite pool".

> Only ingest material whose license permits storage/reuse. License and source
> URL are recorded per document.

## Testing

```bash
npm test          # vitest: crisis detector, chunking, provider selector, retrieval
```

## Deployment (Vercel)

1. Provision Postgres with pgvector (Neon / Vercel Postgres) and run
   `CREATE EXTENSION IF NOT EXISTS vector;` if needed.
2. `npx prisma migrate deploy` against the production database, then ingest your
   corpus into it.
3. Set env vars: `DATABASE_URL`, `LLM_PROVIDER=openrouter`, `OPENROUTER_API_KEY`,
   `OPENROUTER_MODEL`. (The `claude-cli` provider is local-only.)

## Project layout

| Path | Purpose |
| --- | --- |
| `src/lib/prompt/systemPrompt.ts` | **The editable coaching prompt** (spoken + silent-grounding rules) |
| `src/lib/llm/` | Pluggable provider abstraction (OpenRouter, Claude CLI) |
| `src/lib/rag/` | Embeddings, chunking, retrieval, ingestion connectors |
| `src/lib/safety/crisisDetector.ts` | Heuristic crisis safety net |
| `src/app/api/chat/route.ts` | Per-turn orchestration |
| `src/components/VoiceSession.tsx` | The listen → think → speak state machine |
| `scripts/ingest.ts` | Corpus ingestion CLI |
| `prisma/schema.prisma` | Sessions, messages, documents, vector chunks |

## Limitations

- Web Speech API support is uneven (best in Chrome; robotic voices). Voice-only
  has no text fallback by design — the UI guides unsupported browsers.
- Local embeddings make large-corpus ingestion CPU-bound and slow.
- Crisis detection is heuristic — a safety net under the model, never the sole
  line.
- No authentication in v1 (single-user/local). Add per-user auth before any
  multi-user deployment.
