"use client";

/** Read-only transcript line for accessibility. Voice is the primary channel. */
export function LiveCaption({
  interim,
  lastReply,
}: {
  interim: string;
  lastReply: string | null;
}) {
  return (
    <div className="caption" aria-live="polite">
      {interim ? (
        <p className="caption-interim">{interim}</p>
      ) : lastReply ? (
        <p className="caption-reply">{lastReply}</p>
      ) : (
        <p className="caption-hint">Speak when you’re ready — I’m listening.</p>
      )}
    </div>
  );
}
