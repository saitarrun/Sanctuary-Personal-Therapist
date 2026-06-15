"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useSpeechSynthesis,
  type UseSpeechSynthesis,
} from "./useSpeechSynthesis";

// Module-level memo of whether the ElevenLabs proxy is configured. `null` means
// "not yet probed"; once we learn it's unavailable (501) we stop trying and use
// the browser voice for the rest of the session.
let elevenAvailable: boolean | null = null;

/**
 * Coach voice output. Prefers the ElevenLabs cloud voice (via the server-side
 * /api/tts proxy) and transparently falls back to the browser's built-in speech
 * synthesis when ElevenLabs isn't configured or a request fails. Exposes the
 * same interface as useSpeechSynthesis so it's a drop-in replacement.
 */
export function useTts(): UseSpeechSynthesis {
  const browser = useSpeechSynthesis();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stopAudio = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      if (audio.src) URL.revokeObjectURL(audio.src);
      audio.src = "";
      audioRef.current = null;
    }
  }, []);

  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      // Cancel anything currently playing (either path).
      stopAudio();
      browser.cancel();

      if (elevenAvailable === false) {
        browser.speak(text, onDone);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setIsSpeaking(true);

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        setIsSpeaking(false);
        onDone?.();
      };
      const fallback = () => {
        if (settled) return;
        settled = true;
        setIsSpeaking(false);
        browser.speak(text, onDone);
      };

      (async () => {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
            signal: controller.signal,
          });

          if (res.status === 501) {
            elevenAvailable = false;
            fallback();
            return;
          }
          if (!res.ok) {
            fallback();
            return;
          }

          elevenAvailable = true;
          const blob = await res.blob();
          if (controller.signal.aborted) return;

          const audio = new Audio(URL.createObjectURL(blob));
          audioRef.current = audio;
          audio.onended = finish;
          audio.onerror = fallback;
          await audio.play();
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return;
          fallback();
        }
      })();
    },
    [browser, stopAudio]
  );

  const cancel = useCallback(() => {
    stopAudio();
    browser.cancel();
    setIsSpeaking(false);
  }, [browser, stopAudio]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  return {
    // Audio playback is universally supported; browser STT is the real gate,
    // but we keep the browser-synth flag so the unsupported screen still works
    // if neither output path is available.
    supported: browser.supported || elevenAvailable === true,
    isSpeaking: isSpeaking || browser.isSpeaking,
    speak,
    cancel,
  };
}
