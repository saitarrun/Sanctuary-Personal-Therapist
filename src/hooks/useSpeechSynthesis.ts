"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseSpeechSynthesis {
  supported: boolean;
  isSpeaking: boolean;
  /** Speak text aloud; resolves (via onDone) when finished or cancelled. */
  speak: (text: string, onDone?: () => void) => void;
  cancel: () => void;
}

/**
 * Picks a pleasant English voice, preferring natural-sounding local voices.
 */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;
  const preferred = pool.find((v) =>
    /natural|google|samantha|aria|jenny|libby/i.test(v.name)
  );
  return preferred ?? pool[0];
}

export function useSpeechSynthesis(): UseSpeechSynthesis {
  const [supported, setSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const loadVoices = () => {
      voiceRef.current = pickVoice(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onDone?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.rate = 1;
    utterance.pitch = 1;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      setIsSpeaking(false);
      onDone?.();
    };
    utterance.onend = done;
    utterance.onerror = done;
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { supported, isSpeaking, speak, cancel };
}
