export interface CrisisResource {
  name: string;
  contact: string;
  description: string;
  region: string;
}

/**
 * Hotline resources surfaced when the crisis heuristic fires. Region-tagged and
 * intentionally easy to extend. Defaults cover the US plus a generic line.
 */
export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: "988 Suicide & Crisis Lifeline",
    contact: "Call or text 988",
    description: "Free, confidential support 24/7 for people in distress.",
    region: "US",
  },
  {
    name: "Crisis Text Line",
    contact: "Text HOME to 741741",
    description: "24/7 text-based support with a trained crisis counselor.",
    region: "US",
  },
  {
    name: "Emergency services",
    contact: "Call your local emergency number (911 in the US)",
    description:
      "If you or someone else is in immediate danger, contact emergency services right away.",
    region: "Global",
  },
  {
    name: "Find a Helpline",
    contact: "findahelpline.com",
    description:
      "Search free, confidential crisis lines by country if you are outside the US.",
    region: "Global",
  },
];
