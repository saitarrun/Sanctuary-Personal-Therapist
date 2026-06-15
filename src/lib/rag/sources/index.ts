import { DoajConnector } from "./doaj";
import { EuropePmcConnector } from "./europepmc";
import { OpenTextbooksConnector } from "./openTextbooks";
import {
  harvardConnector,
  stanfordConnector,
  journalsConnector,
  psychologyConnector,
  hubermanConnector,
} from "./openalex";
import type { Connector } from "./types";

export const CONNECTORS: Record<string, Connector> = {
  // Aggregator / repository sources
  europepmc: new EuropePmcConnector(),
  doaj: new DoajConnector(),
  openTextbook: new OpenTextbooksConnector(),
  // Institution research output (via OpenAlex, open access only)
  harvard: harvardConnector,
  stanford: stanfordConnector,
  // Curated open-access psychology journals + the psychology subject as a whole
  journals: journalsConnector,
  psychology: psychologyConnector,
  // Researcher-specific output (via OpenAlex author id, open access only)
  huberman: hubermanConnector,
};

export function getConnector(id: string): Connector {
  const c = CONNECTORS[id];
  if (!c) {
    throw new Error(
      `Unknown source "${id}". Available: ${Object.keys(CONNECTORS).join(", ")}`
    );
  }
  return c;
}

export type { Connector, SourceDocument } from "./types";
