"use client";

import { useEffect, useRef } from "react";

export function ParticleFlowShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return;

    function syncSize() {
      if (!canvas) return;
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    const observer = new ResizeObserver(syncSize);
    observer.observe(canvas);
    syncSize();

    const vs = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fs = `
      precision highp float;
      varying vec2 v_texCoord;
      uniform float u_time;
      uniform vec2 u_resolution;

      // Hash function for pseudo-random
      float hash(vec2 p) {
        float h = dot(p, vec2(127.1, 311.7));
        return fract(sin(h) * 43758.5453123);
      }

      // Smooth particle function
      float particle(vec2 p, vec2 center, float size) {
        float d = length(p - center);
        return smoothstep(size * 1.5, 0.0, d) * (0.5 + 0.5 * sin(d * 10.0 - u_time * 0.002));
      }

      void main() {
        vec2 uv = v_texCoord;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.0005;

        vec3 color = vec3(0.0);

        // Create flowing particle field
        for(int i = 0; i < 8; i++) {
          float fi = float(i);
          vec2 center = vec2(
            sin(fi * 1.5 + t) * 1.2,
            cos(fi * 0.7 + t * 0.7) * 0.8 + sin(t * 0.3) * 0.5
          );

          float size = 0.08 + 0.04 * sin(fi + t);
          float intensity = particle(p, center, size);

          vec3 particleColor = mix(
            vec3(0.1, 0.6, 0.8),
            vec3(0.3, 0.8, 0.9),
            sin(fi * 0.5 + t * 0.001) * 0.5 + 0.5
          );

          color += particleColor * intensity * 0.3;
        }

        // Add trailing effect
        for(int i = 0; i < 6; i++) {
          float fi = float(i);
          float offset = fi * 0.15;
          vec2 center = vec2(
            sin(fi * 1.5 + t - offset) * 1.2,
            cos(fi * 0.7 + t * 0.7 - offset) * 0.8 + sin(t * 0.3) * 0.5
          );

          float size = 0.06;
          float intensity = particle(p, center, size) * (1.0 - offset);
          color += vec3(0.15, 0.4, 0.5) * intensity * 0.15;
        }

        // Soft vignette
        float vignette = 1.0 - smoothstep(0.5, 2.0, length(p));
        color *= vignette * 0.9;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    function createShader(type: number, src: string) {
      if (!gl) throw new Error("WebGL context not found");
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }

    const prog = gl.createProgram();
    if (!prog) throw new Error("Failed to create WebGL program");
    gl.attachShader(prog, createShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, createShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_resolution");

    let raf: number;
    function render(t: number) {
      if (!canvas || !gl) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}
