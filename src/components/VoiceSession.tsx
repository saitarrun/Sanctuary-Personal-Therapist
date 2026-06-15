"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { VoiceOrb, type OrbState } from "./VoiceOrb";
import { LiveCaption } from "./LiveCaption";
import { CrisisCard } from "./CrisisCard";
import { SourcePanel, type SourceRef } from "./SourcePanel";
import type { CrisisResource } from "@/lib/prompt/crisisResources";

interface ChatResponse {
  reply: string;
  crisis: boolean;
  resources?: CrisisResource[];
  sources: SourceRef[];
  error?: string;
}

const STATE_LABEL: Record<OrbState, string> = {
  idle: "Tap to begin",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

export function VoiceSession({ sessionId }: { sessionId: string }) {
  const recognition = useSpeechRecognition();
  const synthesis = useSpeechSynthesis();

  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [started, setStarted] = useState(false);
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [resources, setResources] = useState<CrisisResource[] | null>(null);
  const [sources, setSources] = useState<SourceRef[]>([]);
  const [amplitude, setAmplitude] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const orbStateRef = useRef<OrbState>("idle");
  const setOrb = useCallback((s: OrbState) => {
    orbStateRef.current = s;
    setOrbState(s);
  }, []);

  // --- Mic amplitude (for the orb) -----------------------------------------
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
        if (now - lastAmpUpdate.current > 80) {
          lastAmpUpdate.current = now;
          // Only reflect mic level while actually listening.
          setAmplitude(orbStateRef.current === "listening" ? Math.min(1, rms * 3) : 0);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Amplitude is cosmetic; the loop works without it.
    }
  }, []);

  // --- The conversation turn ------------------------------------------------
  const handleFinal = useCallback(
    async (text: string) => {
      // Stop listening while we think + speak (prevents the mic hearing the
      // coach's own voice, which would create a feedback loop).
      recognition.stop();
      setOrb("thinking");
      setResources(null);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text }),
        });
        const data = (await res.json()) as ChatResponse;
        if (!res.ok || data.error) {
          throw new Error(data.error || "Request failed");
        }

        setLastReply(data.reply);
        setSources(data.sources ?? []);
        if (data.crisis && data.resources) setResources(data.resources);

        setOrb("speaking");
        synthesis.speak(data.reply, () => resumeListening());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        resumeListening();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, recognition, synthesis, setOrb]
  );

  const resumeListening = useCallback(() => {
    setOrb("listening");
    recognition.start(handleFinal);
  }, [recognition, handleFinal, setOrb]);

  const begin = useCallback(async () => {
    setError(null);
    setStarted(true);
    await startAmplitudeMeter();
    resumeListening();
  }, [startAmplitudeMeter, resumeListening]);

  // Manual barge-in: interrupt the coach and listen again.
  const interrupt = useCallback(() => {
    synthesis.cancel();
    resumeListening();
  }, [synthesis, resumeListening]);

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

  // --- Unsupported-browser fallback ----------------------------------------
  if (!recognition.supported || !synthesis.supported) {
    return (
      <div className="unsupported">
        <h2>Voice isn’t available in this browser</h2>
        <p>
          This experience uses your browser’s built-in speech recognition and
          speech synthesis. Please open it in a recent version of{" "}
          <strong>Google Chrome</strong> on desktop and allow microphone access.
        </p>
      </div>
    );
  }

  return (
    <div className="voice-session">
      <VoiceOrb state={orbState} amplitude={amplitude} />
      <p className="state-label">{STATE_LABEL[orbState]}</p>

      <LiveCaption interim={recognition.interimTranscript} lastReply={lastReply} />

      {resources ? <CrisisCard resources={resources} /> : null}
      <SourcePanel sources={sources} />

      {(error || recognition.error) && (
        <p className="error">
          {error ?? `Microphone error: ${recognition.error}`}
        </p>
      )}

      <div className="controls">
        {!started ? (
          <button className="btn-primary" onClick={begin}>
            Begin session
          </button>
        ) : (
          <>
            {orbState === "speaking" && (
              <button className="btn-secondary" onClick={interrupt}>
                I’d like to respond
              </button>
            )}
            <button className="btn-ghost" onClick={end}>
              End session
            </button>
          </>
        )}
      </div>
    </div>
  );
}
