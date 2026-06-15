/**
 * Curated set of reputable, open-access psychology journals. Used to build the
 * "journals" ingestion source (filtered via OpenAlex by ISSN). Extend freely —
 * only include journals whose content is open access / reusable.
 */
export interface JournalRef {
  name: string;
  issn: string;
}

export const PSYCH_JOURNALS: JournalRef[] = [
  { name: "Frontiers in Psychology", issn: "1664-1078" },
  { name: "Frontiers in Psychiatry", issn: "1664-0640" },
  { name: "BMC Psychology", issn: "2050-7283" },
  { name: "Europe's Journal of Psychology", issn: "1841-0413" },
  { name: "Behavioral Sciences", issn: "2076-328X" },
  { name: "Clinical Psychology in Europe", issn: "2625-3410" },
  { name: "Cogent Psychology", issn: "2331-1908" },
  { name: "Journal of Intelligence", issn: "2079-3200" },
];

/** "issn1|issn2|..." for an OpenAlex `primary_location.source.issn` filter. */
export function journalIssnFilterValue(): string {
  return PSYCH_JOURNALS.map((j) => j.issn).join("|");
}
