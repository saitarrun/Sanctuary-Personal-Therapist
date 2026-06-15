/**
 * Text extraction helpers for the ingestion pipeline. Server/script only.
 */

/** Strip HTML/XML tags and collapse whitespace into clean prose. */
export function htmlToText(html: string): string {
  return html
    // Drop script/style blocks entirely.
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    // Treat block-level closers as spaces.
    .replace(/<\/(p|div|section|article|h[1-6]|li|br)>/gi, " ")
    // Remove all remaining tags.
    .replace(/<[^>]+>/g, " ")
    // Decode a few common entities.
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract text from a PDF buffer using pdf-parse (lazy-imported). */
export async function pdfToText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}
