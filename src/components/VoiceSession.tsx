"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTts } from "@/hooks/useTts";
import { LiveCaption } from "./LiveCaption";
import { CrisisCard } from "./CrisisCard";
import { BackgroundShader } from "./BackgroundShader";
import type { CrisisResource } from "@/lib/prompt/crisisResources";
import { createSpeechQueueController } from "@/lib/voice/speechQueue";

// Note: BackgroundShader is imported but keeping background clean for now

interface SourceRef {
  title: string;
  authors: string | null;
  url: string | null;
  source: string;
  similarity: number;
}

const STATE_LABEL: Record<string, string> = {
  idle: "Tap to begin",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking...",
};

type OrbState = "idle" | "listening" | "thinking" | "speaking";

export function VoiceSession({ sessionId }: { sessionId: string }) {
  const recognition = useSpeechRecognition();
  const synthesis = useTts();

  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [started, setStarted] = useState(false);
  const [userTranscript, setUserTranscript] = useState<string | null>(null);
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [resources, setResources] = useState<CrisisResource[] | null>(null);
  const [, setSources] = useState<SourceRef[]>([]);
  const [amplitude, setAmplitude] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const orbStateRef = useRef<OrbState>("idle");

  const setOrb = useCallback((s: OrbState) => {
    orbStateRef.current = s;
    setOrbState(s);
  }, []);

  // --- Mic amplitude (for atmospheric feedback) ----------------------------
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastAmpUpdate = useRef(0);

  const startAmplitudeMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const sourceNode = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      sourceNode.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const now = performance.now();
        if (now - lastAmpUpdate.current > 60) {
          lastAmpUpdate.current = now;
          const amp = orbStateRef.current === "listening" ? Math.min(1, rms * 3.5) : 0;
          setAmplitude(amp);
          if (containerRef.current) {
            containerRef.current.style.setProperty("--mic-amp", amp.toString());
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* ignore */
    }
  }, []);

  const resumeListening = useCallback(() => {
    setOrb("listening");
    recognition.start(handleFinal);
  }, [recognition, setOrb]);

  // --- The conversation turn ------------------------------------------------
  const handleFinal = useCallback(
    async (text: string) => {
      recognition.stop();
      setOrb("thinking");
      setResources(null);
      setSources([]);
      setLastReply("");
      setUserTranscript(text);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Request failed");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Response body is not readable.");

        const decoder = new TextDecoder();
        let fullReply = "";
        let buffer = "";
        let spokenIndex = 0;
        const speechQueue = createSpeechQueueController({
          onSpeaking: () => setOrb("speaking"),
          speak: (sentence, onDone) => synthesis.speak(sentence, onDone),
          onQueueDrainedAfterStream: resumeListening,
        });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const part = JSON.parse(trimmed);
              if (part.type === "metadata") {
                setSources(part.sources ?? []);
                if (part.crisis && part.resources) setResources(part.resources);
              } else if (part.type === "chunk") {
                setUserTranscript(null);
                fullReply += part.content;
                setLastReply(fullReply);

                const sentences = fullReply
                  .slice(spokenIndex)
                  .match(/[^.!?]+[.!?]+/g);
                if (sentences) {
                  for (const s of sentences) {
                    speechQueue.enqueue(s.trim());
                    spokenIndex += s.length;
                  }
                  if (!speechQueue.isSpeaking() && speechQueue.pendingCount() > 0) {
                    speechQueue.processQueue();
                  }
                }
              }
            } catch {
              /* ignore */
            }
          }
        }

        const finalLeftover = fullReply.slice(spokenIndex).trim();
        if (finalLeftover) {
          speechQueue.enqueue(finalLeftover);
          if (!speechQueue.isSpeaking()) speechQueue.processQueue();
        }

        // Mark the stream as complete after all final text has been queued.
        // The queue controller resumes listening when the last spoken sentence
        // finishes, which fixes the stuck-after-final-sentence case.
        speechQueue.markStreamFinished();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        resumeListening();
      }
    },
    [sessionId, recognition, synthesis, setOrb, resumeListening]
  );

  const begin = useCallback(async () => {
    setError(null);
    setStarted(true);
    await startAmplitudeMeter();
    resumeListening();
  }, [startAmplitudeMeter, resumeListening]);

  const end = useCallback(() => {
    recognition.stop();
    synthesis.cancel();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    setStarted(false);
    setOrb("idle");
    setAmplitude(0);
  }, [recognition, synthesis, setOrb]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  if (!recognition.supported || !synthesis.supported) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-8 bg-black">
        <h2 className="text-2xl font-semibold mb-4 text-primary-fixed-dim">
          Voice isn’t available in this browser
        </h2>
        <p className="text-on-surface-variant max-w-md leading-relaxed">
          This experience uses your browser’s built-in speech recognition and
          speech synthesis. Please open it in a recent version of{" "}
          <strong>Google Chrome</strong> on desktop and allow microphone access.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }} ref={containerRef}>
      {/* WebGL Background with Perlin Noise Waves */}
      <BackgroundShader />
      {/* Header */}
      <header style={{ position: "relative", zIndex: 10, padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "20px" }}>🧘</span>
          <span style={{ fontSize: "16px", fontWeight: "600", letterSpacing: "-0.5px" }}>Sanctuary</span>
        </div>
        {started && (
          <button
            onClick={end}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
              e.currentTarget.style.color = "rgba(255,255,255,0.9)";
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              e.currentTarget.style.color = "rgba(255,255,255,0.6)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            ✕
          </button>
        )}
      </header>

      {/* Main Content */}
      <main style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 32px", gap: "40px", textAlign: "center", maxWidth: "800px", margin: "0 auto", width: "100%" }}>
        {/* Animated Orb with Sound-Reactive Wave Effects */}
        <div style={{ position: "relative", width: "280px", height: "280px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Sound-reactive waves */}
          {orbState === "listening" && (
            <>
              {/* Wave 1 */}
              <div style={{
                position: "absolute",
                inset: "-30px",
                borderRadius: "50%",
                border: `1px solid rgba(34, 211, 238, ${Math.min(0.3, amplitude * 0.5)})`,
                animation: "wave 2s ease-out infinite",
                transform: `scale(${1 + amplitude * 0.3})`
              }}></div>
              {/* Wave 2 */}
              <div style={{
                position: "absolute",
                inset: "-30px",
                borderRadius: "50%",
                border: `1px solid rgba(34, 211, 238, ${Math.min(0.2, amplitude * 0.3)})`,
                animation: "wave 2s ease-out infinite",
                animationDelay: "0.6s",
                transform: `scale(${1 + amplitude * 0.2})`
              }}></div>
              {/* Wave 3 */}
              <div style={{
                position: "absolute",
                inset: "-30px",
                borderRadius: "50%",
                border: `1px solid rgba(34, 211, 238, ${Math.min(0.15, amplitude * 0.2)})`,
                animation: "wave 2s ease-out infinite",
                animationDelay: "1.2s",
                transform: `scale(${1 + amplitude * 0.1})`
              }}></div>
            </>
          )}

          {/* Idle waves - subtle animation */}
          {orbState !== "listening" && (
            <>
              <div style={{
                position: "absolute",
                inset: "-30px",
                borderRadius: "50%",
                border: "1px solid rgba(34, 211, 238, 0.05)",
                animation: "wave 3s ease-out infinite"
              }}></div>
              <div style={{
                position: "absolute",
                inset: "-30px",
                borderRadius: "50%",
                border: "1px solid rgba(34, 211, 238, 0.05)",
                animation: "wave 3s ease-out infinite",
                animationDelay: "1s"
              }}></div>
              <div style={{
                position: "absolute",
                inset: "-30px",
                borderRadius: "50%",
                border: "1px solid rgba(34, 211, 238, 0.05)",
                animation: "wave 3s ease-out infinite",
                animationDelay: "2s"
              }}></div>
            </>
          )}

          {/* Main Orb - reacts to sound */}
          <div style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `1.5px solid rgba(34, 211, 238, ${0.6 + Math.min(0.4, amplitude * 0.5)})`,
            boxShadow: `0 0 ${40 + amplitude * 20}px rgba(34, 211, 238, ${0.25 + Math.min(0.3, amplitude * 0.3)}), inset 0 0 20px rgba(34, 211, 238, ${0.08 + Math.min(0.12, amplitude * 0.15)})`,
            transition: "all 0.05s linear"
          }}></div>
        </div>

        {/* Listening Indicator */}
        {orbState !== "idle" && (
          <div style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", animation: "pulse-text 2s ease-in-out infinite" }}>
            • {STATE_LABEL[orbState]}
          </div>
        )}

        {/* Message Content with Fade Effect */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          minHeight: "120px",
          maxHeight: "300px",
          overflow: "hidden",
          position: "relative",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)"
        }}>
          <LiveCaption
            interim={recognition.interimTranscript}
            userFinal={userTranscript}
            lastReply={lastReply}
          />
        </div>

        {/* Crisis Resources Modal */}
        {resources && (
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 50, maxWidth: "420px" }}>
            <CrisisCard resources={resources} />
          </div>
        )}

        {/* Action Button */}
        <div>
          {!started ? (
            <button
              onClick={begin}
              style={{
                padding: "11px 28px",
                borderRadius: "6px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "rgba(255,255,255,0.8)",
                fontSize: "13px",
                fontWeight: "600",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
                e.currentTarget.style.color = "rgba(255,255,255,0.95)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                e.currentTarget.style.color = "rgba(255,255,255,0.8)";
              }}
            >
              Begin Session
            </button>
          ) : (
            <button
              onClick={end}
              style={{
                padding: "11px 28px",
                borderRadius: "6px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "rgba(255,255,255,0.8)",
                fontSize: "13px",
                fontWeight: "600",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
                e.currentTarget.style.color = "rgba(255,255,255,0.95)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                e.currentTarget.style.color = "rgba(255,255,255,0.8)";
              }}
            >
              End Session
            </button>
          )}
        </div>

        {error && (
          <p style={{ color: "#ff6b6b", fontSize: "13px", marginTop: "12px" }}>{error}</p>
        )}
      </main>

      {/* Footer */}
      <footer style={{ position: "relative", zIndex: 10, padding: "16px 32px", textAlign: "center", fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: "1.6", maxWidth: "900px", margin: "0 auto", width: "100%" }}>
        This is an AI coaching companion, not a licensed therapist or a crisis service. If you're in danger or crisis, contact local emergency services or a crisis line.
      </footer>
    </div>
  );
}
