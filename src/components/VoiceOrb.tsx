"use client";

import { useEffect, useRef } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Soothing wave-based presence indicator.
 * Oscillates gently using multi-layered translucent waves for a meditative feel.
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
      t += 0.012;
      const s = stateRef.current;
      const cx = size / 2;
      const cy = size / 2;

      ctx.clearRect(0, 0, size, size);

      // Smooth breathing for the glow and pulse
      const breathe = Math.sin(t * 0.5) * 0.05;
      const energy = s === "listening" ? ampRef.current * 0.6 : 
                    s === "speaking" ? 0.15 + Math.abs(Math.sin(t * 4)) * 0.1 :
                    s === "thinking" ? 0.05 + Math.abs(Math.sin(t * 2)) * 0.05 : 0;

      const baseRadius = 100; // Larger fixed radius for the circle
      const scale = 1 + breathe + energy * 0.1;
      const orbRadius = baseRadius * scale;

      // 1. Large Outer Bloom (Atmospheric)
      const bloomRadius = orbRadius * 2.2;
      const bloomGlow = ctx.createRadialGradient(cx, cy, orbRadius * 0.8, cx, cy, bloomRadius);
      const bloomOpacity = 0.08 + energy * 0.15;
      bloomGlow.addColorStop(0, `rgba(111, 238, 225, ${bloomOpacity})`);
      bloomGlow.addColorStop(1, "rgba(111, 238, 225, 0)");
      ctx.fillStyle = bloomGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, bloomRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Inner Diffused Glow
      const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbRadius);
      innerGlow.addColorStop(0, `rgba(111, 238, 225, ${0.1 + energy * 0.2})`);
      innerGlow.addColorStop(0.6, `rgba(79, 209, 197, 0.05)`);
      innerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = innerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
      ctx.fill();

      // 3. Crisp Outer Stroke
      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
      const strokeOpacity = 0.3 + energy * 0.4;
      ctx.strokeStyle = `rgba(111, 238, 225, ${strokeOpacity})`;
      ctx.lineWidth = 1 + energy * 1.5;
      ctx.stroke();

      // 4. Subtle Shimmer Line (Inner)
      ctx.beginPath();
      ctx.arc(cx, cy, orbRadius - 2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + energy * 0.1})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };


    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        width: 280,
        height: 280,
        background: "transparent",
      }}
      aria-hidden="true"
    />
  );
}

