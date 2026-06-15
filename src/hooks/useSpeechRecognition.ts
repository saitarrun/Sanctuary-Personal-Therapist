"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in the standard DOM lib).
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): { transcript: string };
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  };
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechRecognition {
  supported: boolean;
  isListening: boolean;
  interimTranscript: string;
  error: string | null;
  /** Start listening. onFinal fires once a final utterance is recognized. */
  start: (onFinal: (text: string) => void) => void;
  stop: () => void;
}

export function useSpeechRecognition(lang = "en-US"): UseSpeechRecognition {
  const [supported, setSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef<(text: string) => void>(() => {});
  const manualStopRef = useRef(false);

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          const finalText = transcript.trim();
          if (finalText) onFinalRef.current(finalText);
          setInterim("");
        } else {
          interim += transcript;
        }
      }
      if (interim) setInterim(interim);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error);
    };

    recognition.onend = () => {
      // Auto-restart unless the caller asked to stop (keeps the loop "always on").
      if (!manualStopRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          /* already started */
        }
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      manualStopRef.current = true;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* noop */
      }
    };
  }, [lang]);

  const start = useCallback((onFinal: (text: string) => void) => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    onFinalRef.current = onFinal;
    manualStopRef.current = false;
    setError(null);
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      // Calling start() while already running throws; treat as listening.
      setIsListening(true);
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    manualStopRef.current = true;
    setInterim("");
    try {
      recognition.stop();
    } catch {
      /* noop */
    }
    setIsListening(false);
  }, []);

  return { supported, isListening, interimTranscript, error, start, stop };
}
