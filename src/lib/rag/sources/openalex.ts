import { pdfToText } from "../extract";
import { journalIssnFilterValue } from "./journals";
import type { Connector, SourceDocument } from "./types";

const API = "https://api.openalex.org/works";

interface OpenAlexLocation {
  pdf_url?: string | null;
  landing_page_url?: string | null;
  license?: string | null;
}
interface OpenAlexWork {
  id?: string; // e.g. "https://openalex.org/W2741809807"
  doi?: string | null;
  display_name?: string | null;
  title?: string | null;
  publication_year?: number;
  abstract_inverted_index?: Record<string, number[]> | null;
  authorships?: { author?: { display_name?: string } }[];
  best_oa_location?: OpenAlexLocation | null;
  primary_location?: OpenAlexLocation | null;
}

/**
 * Reconstruct an abstract from OpenAlex's inverted index
 * ({ word: [positions...] }) back into running text. Pure + unit-tested.
 */
export function reconstructAbstract(
  index: Record<string, number[]> | null | undefined
): string {
  if (!index) return "";
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) slots[pos] = word;
  }
  return slots.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Generic OpenAlex connector. A `baseFilter` scopes the works (by institution
 * ROR, journal ISSN, subject concept, …); every preset also restricts to
 * open-access. Indexes title + reconstructed abstract by default (open metadata,
 * freely reusable); set OPENALEX_FULLTEXT=1 to also best-effort fetch open-access
 * PDFs (slower).
 */
export class OpenAlexConnector implements Connector {
  readonly id: string;
  private readonly label: string;
  private readonly baseFilter: string;

  constructor(opts: { id: string; label: string; baseFilter: string }) {
    this.id = opts.id;
    this.label = opts.label;
    this.baseFilter = opts.baseFilter;
  }

  async fetch(query: string, limit: number): Promise<SourceDocument[]> {
    const url = new URL(API);
    url.searchParams.set("filter", `${this.baseFilter},is_oa:true`);
    if (query.trim()) url.searchParams.set("search", query.trim());
    url.searchParams.set("per_page", String(Math.min(limit, 200)));
    url.searchParams.set("sort", "cited_by_count:desc");
    // OpenAlex "polite pool" — a contact speeds up and stabilizes requests.
    url.searchParams.set(
      "mailto",
      process.env.OPENALEX_MAILTO ?? "personal-psychologist@example.com"
    );

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`OpenAlex (${this.label}) search failed (${res.status})`);
    }
    const data = (await res.json()) as { results?: OpenAlexWork[] };
    const results = data.results ?? [];
    const wantFullText = process.env.OPENALEX_FULLTEXT === "1";

    const docs: SourceDocument[] = [];
    for (const w of results) {
      if (docs.length >= limit) break;
      const title = (w.display_name ?? w.title ?? "").trim();
      if (!title) continue;

      let text = reconstructAbstract(w.abstract_inverted_index);
      const oa = w.best_oa_location ?? w.primary_location ?? {};

      if (wantFullText && oa.pdf_url) {
        const full = await this.tryPdf(oa.pdf_url);
        if (full && full.length > text.length) text = full;
      }
      if (!text || text.length < 200) continue;

      const authors = w.authorships
        ?.map((a) => a.author?.display_name)
        .filter(Boolean)
        .slice(0, 8)
        .join(", ");
      const externalId = w.id?.split("/").pop();

      docs.push({
        title,
        authors: authors || undefined,
        source: this.id,
        externalId: externalId ?? title,
        url: oa.landing_page_url ?? w.id ?? w.doi ?? undefined,
        license: oa.license ?? "open-access",
        text: `${title}. ${text}`,
      });
    }
    return docs;
  }

  private async tryPdf(pdfUrl: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(pdfUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const type = res.headers.get("content-type") ?? "";
      if (!/pdf/i.test(type) && !/\.pdf($|\?)/i.test(pdfUrl)) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > 15 * 1024 * 1024) return null; // cap at 15MB
      const text = await pdfToText(buf);
      return text.length > 500 ? text : null;
    } catch {
      return null;
    }
  }
}

// Institution ROR ids.
const HARVARD_ROR = "https://ror.org/03vek6s52";
const STANFORD_ROR = "https://ror.org/00f54p054";

// Psychology subject concept (OpenAlex concept "Psychology").
const PSYCHOLOGY_CONCEPT = "C15744967";

export const harvardConnector = new OpenAlexConnector({
  id: "harvard",
  label: "Harvard",
  baseFilter: `authorships.institutions.ror:${HARVARD_ROR}`,
});

export const stanfordConnector = new OpenAlexConnector({
  id: "stanford",
  label: "Stanford",
  baseFilter: `authorships.institutions.ror:${STANFORD_ROR}`,
});

export const journalsConnector = new OpenAlexConnector({
  id: "journals",
  label: "OA psychology journals",
  baseFilter: `primary_location.source.issn:${journalIssnFilterValue()}`,
});

export const psychologyConnector = new OpenAlexConnector({
  id: "psychology",
  label: "Psychology (subject)",
  baseFilter: `concepts.id:${PSYCHOLOGY_CONCEPT}`,
});
