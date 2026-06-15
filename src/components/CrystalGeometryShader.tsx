"use client";

import { useEffect, useRef } from "react";

export function CrystalGeometryShader() {
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

      // Hexagon distance field
      float hexagon(vec2 p, float scale) {
        p = abs(p);
        return max((p.x * 0.866025 + p.y * 0.5), p.y) - scale;
      }

      // Grid pattern with rotation
      float crystalPattern(vec2 p) {
        float scale = 0.3;
        float angle = atan(p.y, p.x);
        float dist = length(p);

        // Rotate and scale for crystalline look
        p = vec2(cos(angle + u_time * 0.0001) * dist, sin(angle + u_time * 0.0001) * dist);

        float hex = hexagon(p, scale);
        float gridX = fract(p.x / (scale * 2.0)) - 0.5;
        float gridY = fract(p.y / (scale * 2.0)) - 0.5;

        return hex * 0.5 + (gridX * gridX + gridY * gridY) * 0.3;
      }

      void main() {
        vec2 uv = v_texCoord;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        float pattern = crystalPattern(p);
        float lines = abs(sin(pattern * 15.0)) * 0.5 + 0.5;

        // Color based on distance and pattern
        vec3 color1 = vec3(0.05, 0.1, 0.15);
        vec3 color2 = vec3(0.15, 0.4, 0.5);
        vec3 color3 = vec3(0.05, 0.6, 0.7);

        vec3 color = mix(color1, color2, lines);
        color = mix(color, color3, smoothstep(0.3, 0.0, pattern) * 0.4);

        // Add energy pulses
        float pulse = sin(u_time * 0.0003 - length(p) * 2.0) * 0.5 + 0.5;
        color += vec3(0.2, 0.6, 0.8) * pulse * 0.2 * smoothstep(2.0, 0.5, length(p));

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
