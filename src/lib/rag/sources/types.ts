/** A document produced by a connector, ready to chunk + embed. */
export interface SourceDocument {
  title: string;
  authors?: string;
  /** Connector id, e.g. "europepmc". */
  source: string;
  externalId?: string;
  url?: string;
  license?: string;
  text: string;
}

export interface Connector {
  readonly id: string;
  /**
   * Fetch up to `limit` open-access documents for `query`. Implementations must
   * only return material whose license permits storage/reuse.
   */
  fetch(query: string, limit: number): Promise<SourceDocument[]>;
}
