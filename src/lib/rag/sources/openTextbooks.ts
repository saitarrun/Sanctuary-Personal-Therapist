import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { htmlToText, pdfToText } from "../extract";
import type { Connector, SourceDocument } from "./types";

const CORPUS_DIR = process.env.CORPUS_DIR ?? "corpus";

/**
 * Local open-textbook connector. Reads CC-licensed files the user drops into the
 * `corpus/` directory (PDF, TXT, Markdown, HTML). This is the reliable path for
 * ingesting open textbooks (e.g. OpenStax Psychology) and any other
 * legally-shareable material you have on disk.
 *
 * The `query` is ignored — every readable file is ingested. Put a LICENSE note in
 * the filename if you want it recorded (e.g. "openstax-psychology.CC-BY.pdf").
 */
export class OpenTextbooksConnector implements Connector {
  readonly id = "openTextbook";

  async fetch(_query: string, limit: number): Promise<SourceDocument[]> {
    let entries: string[];
    try {
      entries = await readdir(CORPUS_DIR);
    } catch {
      console.warn(
        `[openTextbook] No '${CORPUS_DIR}/' directory found — nothing to ingest. ` +
          `Drop CC-licensed .pdf/.txt/.md/.html files there.`
      );
      return [];
    }

    const docs: SourceDocument[] = [];
    for (const entry of entries) {
      if (docs.length >= limit) break;
      const path = join(CORPUS_DIR, entry);
      const info = await stat(path).catch(() => null);
      if (!info?.isFile()) continue;

      const text = await this.readFileText(path).catch((err) => {
        console.warn(`[openTextbook] skipping ${entry}: ${err.message}`);
        return "";
      });
      if (!text || text.length < 200) continue;

      docs.push({
        title: cleanTitle(entry),
        source: this.id,
        externalId: entry,
        license: licenseFromName(entry),
        text,
      });
    }
    return docs;
  }

  private async readFileText(path: string): Promise<string> {
    const ext = extname(path).toLowerCase();
    if (ext === ".pdf") {
      return pdfToText(await readFile(path));
    }
    const raw = await readFile(path, "utf8");
    if (ext === ".html" || ext === ".htm") return htmlToText(raw);
    return raw.replace(/\s+\n/g, "\n").trim();
  }
}

function cleanTitle(filename: string): string {
  return basename(filename, extname(filename))
    .replace(/\.(CC-?BY[\w-]*)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function licenseFromName(filename: string): string {
  const m = filename.match(/CC-?BY[\w-]*/i);
  return m ? m[0].toUpperCase() : "user-provided";
}
