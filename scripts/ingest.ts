/**
 * Ingestion CLI: fetch open-access psychology material, chunk it, embed it
 * locally, and store it in Postgres + pgvector.
 *
 *   npx tsx scripts/ingest.ts --source europepmc --query "cognitive behavioral therapy" --limit 25
 *   npx tsx scripts/ingest.ts --source doaj --query "anxiety coping" --limit 50
 *   npx tsx scripts/ingest.ts --source openTextbook   # reads ./corpus/*
 *
 * Idempotent: documents are upserted on (source, externalId); re-running replaces
 * a document's chunks rather than duplicating them.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { chunkText } from "../src/lib/rag/chunk";
import { embedBatch } from "../src/lib/rag/embeddings";
import { getConnector, type SourceDocument } from "../src/lib/rag/sources";

interface Args {
  source: string;
  query: string;
  limit: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { source: "", query: "", limit: 25, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--source") args.source = argv[++i];
    else if (a === "--query") args.query = argv[++i];
    else if (a === "--limit") args.limit = parseInt(argv[++i], 10);
    else if (a === "--dry-run") args.dryRun = true;
  }
  if (!args.source) {
    throw new Error(
      "Missing --source. Try: --source europepmc|doaj|openTextbook"
    );
  }
  return args;
}

const VECTOR_LITERAL = (vec: number[]) => `[${vec.join(",")}]`;

async function storeDocument(doc: SourceDocument): Promise<number> {
  const chunks = chunkText(doc.text);
  if (chunks.length === 0) return 0;

  const embeddings = await embedBatch(chunks);

  // Upsert the document, then replace its chunks atomically.
  const document = await prisma.document.upsert({
    where: {
      source_externalId: {
        source: doc.source,
        externalId: doc.externalId ?? doc.title,
      },
    },
    update: { title: doc.title, authors: doc.authors, url: doc.url, license: doc.license },
    create: {
      title: doc.title,
      authors: doc.authors,
      source: doc.source,
      externalId: doc.externalId ?? doc.title,
      url: doc.url,
      license: doc.license,
    },
  });

  await prisma.chunk.deleteMany({ where: { documentId: document.id } });

  // Insert chunks with their vectors. The embedding column is pgvector, which
  // Prisma can't set via the typed client, so we write it with raw SQL.
  for (let i = 0; i < chunks.length; i++) {
    const id = `${document.id}-${i}`;
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Chunk" ("id", "documentId", "ordinal", "content", "embedding", "createdAt")
      VALUES (${id}, ${document.id}, ${i}, ${chunks[i]}, ${VECTOR_LITERAL(
        embeddings[i]
      )}::vector, NOW())
    `);
  }
  return chunks.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const connector = getConnector(args.source);

  console.log(
    `Fetching up to ${args.limit} docs from "${args.source}"` +
      (args.query ? ` for "${args.query}"` : "") +
      "…"
  );
  const docs = await connector.fetch(args.query, args.limit);
  console.log(`Got ${docs.length} document(s).`);

  if (args.dryRun) {
    for (const d of docs) {
      console.log(
        `- ${d.title} [${d.license ?? "?"}] (${d.text.length} chars)`
      );
    }
    console.log("Dry run — nothing written.");
    return;
  }

  let totalChunks = 0;
  for (const doc of docs) {
    const n = await storeDocument(doc);
    totalChunks += n;
    console.log(`  • ${doc.title} → ${n} chunk(s)`);
  }
  console.log(
    `Done. Stored ${docs.length} document(s), ${totalChunks} chunk(s).`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
