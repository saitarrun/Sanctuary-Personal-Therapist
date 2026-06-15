"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseSpeechSynthesis {
  supported: boolean;
  isSpeaking: boolean;
  /** Speak text aloud; resolves (via onDone) when finished or cancelled. */
  speak: (text: string, onDone?: () => void) => void;
  cancel: () => void;
}

// Soothing delivery: a touch slower than natural speech, with a slightly
// lower, warmer pitch and a gentle volume.
const SOOTHING_RATE = 0.9;
const SOOTHING_PITCH = 0.92;
const SOOTHING_VOLUME = 0.95;

// Warm, calm-sounding voices known to be pleasant for a coaching tone, in
// rough order of preference. Apple's Enhanced/Premium variants and the major
// neural voices sound markedly more natural than the default robotic ones.
const SOOTHING_VOICE_NAMES = [
  "samantha",
  "ava",
  "allison",
  "serena",
  "zoe",
  "nora",
  "karen",
  "moira",
  "fiona",
  "aria",
  "jenny",
  "libby",
  "sonia",
];

// Preferred voice, in priority order. The first one the browser actually
// exposes wins; if none are present we fall back to the scoring heuristic below.
const PINNED_VOICE_NAMES = ["Google UK English Female"];

/**
 * Picks the coach's voice. Prefers an explicitly pinned voice when the browser
 * exposes it; otherwise scores each English voice by audio quality markers
 * (Enhanced/Premium/Neural/Natural) and how warm/calm the named voice tends to
 * sound, falling back to any English voice.
 */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  for (const name of PINNED_VOICE_NAMES) {
    const pinned = voices.find((v) => v.name === name);
    if (pinned) return pinned;
  }

  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;

  const score = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    let s = 0;
    // High-quality, natural-sounding engines.
    if (/(enhanced|premium|neural|natural)/.test(name)) s += 40;
    if (/google/.test(name)) s += 20;
    // Named warm/calm voices — earlier in the list scores higher.
    const idx = SOOTHING_VOICE_NAMES.findIndex((n) => name.includes(n));
    if (idx !== -1) s += 30 - idx;
    // Prefer local voices: lower latency, no network artifacts.
    if (v.localService) s += 5;
    // Mild preference for en-US / en-GB phrasing.
    if (/^en-(us|gb)/i.test(v.lang)) s += 3;
    return s;
  };

  return [...pool].sort((a, b) => score(b) - score(a))[0];
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
    utterance.rate = SOOTHING_RATE;
    utterance.pitch = SOOTHING_PITCH;
    utterance.volume = SOOTHING_VOLUME;
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
