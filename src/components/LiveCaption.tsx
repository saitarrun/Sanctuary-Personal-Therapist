"use client";

/** Read-only transcript line for accessibility. Voice is the primary channel. */
export function LiveCaption({
  interim,
  userFinal,
  lastReply,
}: {
  interim: string;
  userFinal: string | null;
  lastReply: string | null;
}) {
  const displaySource = interim || userFinal;
  const content = displaySource || lastReply || "Speak when you’re ready — I’m listening.";
  const isHint = !displaySource && !lastReply;

  // Get only the last 2 sentences
  const getLastTwoSentences = (text: string) => {
    // Split by sentence boundaries (., !, ?) but keep the punctuation
    const sentences = text.match(/[^.!?]*[.!?]+/g) || [text];
    const trimmedSentences = sentences
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    // Get last 2 sentences
    const lastTwo = trimmedSentences.slice(-2);
    return lastTwo.length > 0 ? lastTwo.join(" ") : text;
  };

  const displayText = lastReply ? getLastTwoSentences(lastReply) : (displaySource || content);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        maxHeight: "160px",
        overflow: "hidden",
      }}
      aria-live="polite"
    >
      <div
        style={{
          textAlign: "center",
          width: "100%",
          maxWidth: "900px",
          animation: "fade-in 0.5s ease-in-out",
        }}
      >
        {displaySource ? (
          <p
            style={{
              fontFamily: "Manrope, system-ui, sans-serif",
              fontSize: "24px",
              color: "rgba(255, 255, 255, 0.65)",
              fontStyle: "italic",
              fontWeight: 400,
              lineHeight: "1.6",
              margin: 0,
              transition: "all 0.3s ease-out",
              letterSpacing: "-0.3px",
            }}
          >
            {displaySource}
          </p>
        ) : lastReply ? (
          <h1
            style={{
              fontFamily: "Manrope, system-ui, sans-serif",
              fontSize: "28px",
              color: "white",
              fontWeight: 500,
              lineHeight: "1.6",
              margin: 0,
              textShadow: "0 4px 20px rgba(79, 209, 197, 0.3)",
              transition: "all 0.3s ease-out",
              letterSpacing: "-0.5px",
            }}
          >
            {displayText}
          </h1>
        ) : (
          <p
            style={{
              fontFamily: "Manrope, system-ui, sans-serif",
              color: "rgba(187, 201, 199, 0.6)",
              fontSize: "16px",
              fontStyle: "italic",
              fontWeight: 400,
              opacity: 0.6,
              margin: 0,
              letterSpacing: "-0.2px",
            }}
          >
            Speak when you’re ready — I’m listening.
          </p>
        )}
      </div>
    </div>
  );
}
