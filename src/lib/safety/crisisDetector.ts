/**
 * Lightweight, heuristic crisis detector. A safety net layered UNDER the model's
 * own judgement — never the sole line of defense. False positives/negatives are
 * expected; keep the patterns easy to extend.
 */

// Word-boundary phrases. Each is matched case-insensitively against the text.
const CRISIS_PATTERNS: RegExp[] = [
  // Suicidal ideation
  /\bkill myself\b/i,
  /\bkilling myself\b/i,
  /\bend my life\b/i,
  /\bending my life\b/i,
  /\btake my own life\b/i,
  /\bwant to die\b/i,
  /\bwanna die\b/i,
  /\bwish i (was|were) dead\b/i,
  /\bbetter off dead\b/i,
  /\bcommit suicide\b/i,
  /\bsuicidal\b/i,
  /\bno reason to live\b/i,
  /\bdon'?t want to (be alive|live)\b/i,
  // Self-harm
  /\bhurt myself\b/i,
  /\bharm myself\b/i,
  /\bcut myself\b/i,
  /\bcutting myself\b/i,
  /\bself[-\s]?harm\b/i,
  // Abuse / danger
  /\bbeing abused\b/i,
  /\bbeing hurt by\b/i,
  /\bhe hits me\b/i,
  /\bshe hits me\b/i,
  /\bthey hit me\b/i,
  /\bin danger\b/i,
  /\bafraid for my life\b/i,
];

export interface CrisisResult {
  triggered: boolean;
  matched: string[];
}

export function detectCrisis(text: string): CrisisResult {
  if (!text) return { triggered: false, matched: [] };
  const matched: string[] = [];
  for (const pattern of CRISIS_PATTERNS) {
    const m = text.match(pattern);
    if (m) matched.push(m[0]);
  }
  return { triggered: matched.length > 0, matched };
}
