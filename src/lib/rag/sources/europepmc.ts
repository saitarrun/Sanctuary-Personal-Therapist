import { htmlToText } from "../extract";
import type { Connector, SourceDocument } from "./types";

const SEARCH = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
const FULLTEXT = "https://www.ebi.ac.uk/europepmc/webservices/rest";

interface EuropePmcResult {
  id?: string;
  source?: string;
  pmcid?: string;
  title?: string;
  authorString?: string;
  isOpenAccess?: string; // "Y" / "N"
  license?: string;
  abstractText?: string;
}

/**
 * Europe PMC connector. Restricts to open-access full-text articles and pulls the
 * full text when available, falling back to the abstract. License is captured per
 * document for compliance.
 */
export class EuropePmcConnector implements Connector {
  readonly id = "europepmc";

  async fetch(query: string, limit: number): Promise<SourceDocument[]> {
    const url = new URL(SEARCH);
    url.searchParams.set("query", `${query} AND OPEN_ACCESS:Y`);
    url.searchParams.set("format", "json");
    url.searchParams.set("resultType", "core");
    url.searchParams.set("pageSize", String(Math.min(limit, 100)));

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Europe PMC search failed (${res.status})`);
    }
    const data = (await res.json()) as {
      resultList?: { result?: EuropePmcResult[] };
    };
    const results = data.resultList?.result ?? [];

    const docs: SourceDocument[] = [];
    for (const r of results) {
      if (docs.length >= limit) break;
      if (r.isOpenAccess !== "Y" || !r.pmcid) continue;

      let text = r.abstractText ? htmlToText(r.abstractText) : "";
      const full = await this.tryFullText(r.pmcid);
      if (full) text = full;
      if (!text || text.length < 200) continue;

      docs.push({
        title: r.title?.replace(/\.$/, "") ?? "Untitled",
        authors: r.authorString,
        source: this.id,
        externalId: r.pmcid,
        url: `https://europepmc.org/article/PMC/${r.pmcid}`,
        license: r.license ?? "open-access",
        text,
      });
    }
    return docs;
  }

  private async tryFullText(pmcid: string): Promise<string | null> {
    try {
      const res = await fetch(`${FULLTEXT}/PMC/${pmcid}/fullTextXML`);
      if (!res.ok) return null;
      const xml = await res.text();
      const text = htmlToText(xml);
      return text.length > 500 ? text : null;
    } catch {
      return null;
    }
  }
}
