"use client";

import { useEffect, useRef } from "react";

export function FluidInkShader() {
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
      uniform vec2 u_mouse;

      // Simplex noise approximation
      vec2 hash(vec2 p) {
        return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);

        float n00 = dot(hash(i + vec2(0, 0)), f - vec2(0, 0));
        float n10 = dot(hash(i + vec2(1, 0)), f - vec2(1, 0));
        float n01 = dot(hash(i + vec2(0, 1)), f - vec2(0, 1));
        float n11 = dot(hash(i + vec2(1, 1)), f - vec2(1, 1));

        float nx0 = mix(n00, n10, u.x);
        float nx1 = mix(n01, n11, u.x);
        return mix(nx0, nx1, u.y);
      }

      void main() {
        vec2 uv = v_texCoord;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.0003;

        // Mouse position normalized
        vec2 mousePos = u_mouse / u_resolution;
        vec2 mouseNorm = mousePos * 2.0 - 1.0;
        mouseNorm.x *= u_resolution.x / u_resolution.y;

        // Multi-scale turbulent flow
        vec2 flowPoint = p + vec2(sin(t) * 0.5, cos(t * 0.7) * 0.5);

        float turbulence = 0.0;
        float frequency = 1.0;
        float amplitude = 1.0;
        for(int i = 0; i < 5; i++) {
          turbulence += noise(flowPoint * frequency + vec2(t * (float(i) + 1.0) * 0.2, 0.0)) * amplitude;
          frequency *= 2.0;
          amplitude *= 0.5;
        }

        // Mouse influence on flow
        float distToMouse = distance(p, mouseNorm);
        float mouseInfluence = exp(-distToMouse * 2.0) * 0.6;
        turbulence += mouseInfluence * sin(distToMouse * 10.0 - t * 10.0) * 0.3;

        // Color based on turbulence and position
        vec3 color1 = vec3(0.02, 0.05, 0.08);
        vec3 color2 = vec3(0.1, 0.35, 0.5);
        vec3 color3 = vec3(0.2, 0.6, 0.7);

        vec3 color = mix(color1, color2, (turbulence * 0.5 + 0.5));
        color = mix(color, color3, smoothstep(-0.5, 0.5, turbulence) * 0.4);

        // Add bright wisps at mouse
        color = mix(color, vec3(0.3, 0.8, 0.9), mouseInfluence * 0.5);

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
    const uMouse = gl.getUniformLocation(prog, "u_mouse");

    let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    const handleMouseMove = (event: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        mouse.x = event.clientX - rect.left;
        mouse.y = event.clientY - rect.top;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);

    let raf: number;
    function render(t: number) {
      if (!canvas || !gl) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => {
      observer.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
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
