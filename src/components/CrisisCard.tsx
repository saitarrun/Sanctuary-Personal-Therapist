"use client";

import type { CrisisResource } from "@/lib/prompt/crisisResources";

/** Visible hotline resources, shown when the crisis heuristic fires. */
export function CrisisCard({ resources }: { resources: CrisisResource[] }) {
  return (
    <div className="crisis-card" role="alert">
      <h2>You don’t have to go through this alone</h2>
      <p>
        It sounds like you’re going through something serious. Please reach out
        to someone who can help right now.
      </p>
      <ul>
        {resources.map((r) => (
          <li key={r.name}>
            <strong>{r.name}</strong> — {r.contact}
            <span className="crisis-desc">{r.description}</span>
          </li>
        ))}
      </ul>
      <p className="crisis-note">
        This app is a supportive coach, not a substitute for professional or
        emergency care.
      </p>
    </div>
  );
}
