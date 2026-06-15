import { htmlToText } from "../extract";
import type { Connector, SourceDocument } from "./types";

const API = "https://doaj.org/api/v2/search/articles";

interface DoajArticle {
  id?: string;
  bibjson?: {
    title?: string;
    abstract?: string;
    author?: { name?: string }[];
    link?: { url?: string; type?: string }[];
    journal?: { license?: { type?: string }[] };
  };
}

/**
 * DOAJ (Directory of Open Access Journals) connector. Every article in DOAJ is
 * open access. We index title + abstract (full text isn't exposed by the API);
 * license comes from the journal record.
 */
export class DoajConnector implements Connector {
  readonly id = "doaj";

  async fetch(query: string, limit: number): Promise<SourceDocument[]> {
    const pageSize = Math.min(limit, 100);
    const url = `${API}/${encodeURIComponent(query)}?pageSize=${pageSize}`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`DOAJ search failed (${res.status})`);
    }
    const data = (await res.json()) as { results?: DoajArticle[] };
    const results = data.results ?? [];

    const docs: SourceDocument[] = [];
    for (const r of results) {
      if (docs.length >= limit) break;
      const b = r.bibjson;
      if (!b?.title || !b.abstract) continue;

      const text = htmlToText(b.abstract);
      if (text.length < 200) continue;

      const authors = b.author
        ?.map((a) => a.name)
        .filter(Boolean)
        .join(", ");
      const link = b.link?.find((l) => l.type === "fulltext")?.url ?? b.link?.[0]?.url;
      const license = b.journal?.license?.[0]?.type;

      docs.push({
        title: b.title,
        authors: authors || undefined,
        source: this.id,
        externalId: r.id,
        url: link,
        license: license ?? "open-access",
        text,
      });
    }
    return docs;
  }
}
