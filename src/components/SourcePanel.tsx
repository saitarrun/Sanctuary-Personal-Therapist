"use client";

export interface SourceRef {
  title: string;
  authors?: string | null;
  url?: string | null;
  source: string;
  similarity?: number;
}

/**
 * Optional, on-screen list of the passages that silently grounded the last
 * reply. The coach never reads these aloud.
 */
export function SourcePanel({ sources }: { sources: SourceRef[] }) {
  if (sources.length === 0) return null;
  return (
    <details className="source-panel">
      <summary>Background drawn on ({sources.length})</summary>
      <ul>
        {sources.map((s, i) => (
          <li key={i}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            ) : (
              <span>{s.title}</span>
            )}
            {s.authors ? <span className="src-authors"> — {s.authors}</span> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
