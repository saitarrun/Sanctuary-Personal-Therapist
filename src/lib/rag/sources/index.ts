import { DoajConnector } from "./doaj";
import { EuropePmcConnector } from "./europepmc";
import { OpenTextbooksConnector } from "./openTextbooks";
import type { Connector } from "./types";

export const CONNECTORS: Record<string, Connector> = {
  europepmc: new EuropePmcConnector(),
  doaj: new DoajConnector(),
  openTextbook: new OpenTextbooksConnector(),
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
