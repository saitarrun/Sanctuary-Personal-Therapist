"use client";

import { useEffect, useRef } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

const STATE_COLORS: Record<OrbState, [string, string]> = {
  idle: ["#3b4a6b", "#1e2740"],
  listening: ["#22d3ee", "#0e7490"],
  thinking: ["#a78bfa", "#6d28d9"],
  speaking: ["#34d399", "#047857"],
};

/**
 * Animated presence orb. Pulses gently by default and reacts to `amplitude`
 * (0..1, mic level while listening) and the conversation `state`.
 */
export function VoiceOrb({
  state,
  amplitude = 0,
}: {
  state: OrbState;
  amplitude?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const ampRef = useRef(amplitude);

  stateRef.current = state;
  ampRef.current = amplitude;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 280;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let t = 0;

    const draw = () => {
      t += 0.016;
      const s = stateRef.current;
      const [inner, outer] = STATE_COLORS[s];
      const cx = size / 2;
      const cy = size / 2;

      ctx.clearRect(0, 0, size, size);

      // Breathing baseline + state energy + live amplitude.
      const breathe = Math.sin(t * 1.4) * 0.04;
      const energy =
        s === "thinking"
          ? 0.06 + Math.abs(Math.sin(t * 4)) * 0.05
          : s === "speaking"
          ? 0.1 + Math.abs(Math.sin(t * 9)) * 0.12
          : s === "listening"
          ? 0.05 + ampRef.current * 0.35
          : 0.02;
      const radius = 70 * (1 + breathe + energy);

      // Outer glow.
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 1.9);
      glow.addColorStop(0, `${inner}55`);
      glow.addColorStop(1, "#00000000");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.9, 0, Math.PI * 2);
      ctx.fill();

      // Core orb.
      const core = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.3,
        radius * 0.2,
        cx,
        cy,
        radius
      );
      core.addColorStop(0, inner);
      core.addColorStop(1, outer);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 280, height: 280 }}
      aria-hidden="true"
    />
  );
}
