"use client";

import { useEffect, useRef, useState } from "react";
import { logError, ShaderError, generateRequestId } from "@/lib/errors/errorHandler";

export function AuraEnergyShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webglError, setWebglError] = useState<Error | null>(null);
  const requestId = useRef(generateRequestId()).current;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const gl = (canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
      if (!gl) {
        const error = new ShaderError(
          "WebGL is not supported on this device. Using CSS gradient fallback.",
          { component: "AuraEnergyShader" },
          requestId
        );
        logError(error, requestId);
        setWebglError(error);
        return;
      }

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

        // Simplex-like noise
        float snoise(vec2 v){
          vec2 i  = floor(v + dot(v, vec2(0.366025403784439)));
          vec2 x0 = v -   i + dot(i, vec2(0.211324865405187));
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + vec2(0.211324865405187, -0.577350269189626).xyyx;
          x12.xy -= i1;
          i = mod(i, 289.0);
          vec3 p = vec3(dot(i, vec2(127.1, 311.7)), dot(i + i1, vec2(127.1, 311.7)), dot(i + 1.0, vec2(127.1, 311.7)));
          p = fract(p * 0.024390243902439);
          p -= floor(p + 0.5);
          return fract(p.x + dot(x0, vec2(0.211324865405187)) + dot(x12.xy, vec2(0.211324865405187)));
        }

        void main() {
          vec2 uv = v_texCoord;
          vec2 p = uv * 2.0 - 1.0;
          p.x *= u_resolution.x / u_resolution.y;

          float t = u_time * 0.0002;

          // Mouse position normalized
          vec2 mousePos = u_mouse / u_resolution;
          vec2 mouseNorm = mousePos * 2.0 - 1.0;
          mouseNorm.x *= u_resolution.x / u_resolution.y;

          // Center aura
          float distFromCenter = length(p);
          float distFromMouse = length(p - mouseNorm);

          // Radial waves from center
          float centerWave = sin(distFromCenter * 3.0 - t * 5.0) * 0.5 + 0.5;
          centerWave *= exp(-distFromCenter * 0.5);

          // Mouse-driven aura
          float mouseAura = exp(-distFromMouse * 3.0);
          mouseAura *= (sin(t * 4.0 - distFromMouse * 2.0) * 0.5 + 0.7);

          // Rotating field
          float angle = atan(p.y, p.x);
          float rotatingField = sin(angle * 4.0 + t * 3.0) * 0.5 + 0.5;
          rotatingField *= sin(distFromCenter * 2.0 - t * 2.0) * 0.5 + 0.5;

          // Noise-based energy ripples
          float energyFlow = snoise(p * 2.0 + vec2(t, t * 0.7));
          float noisePattern = snoise(p * 4.0 + vec2(t * 0.5, t * 0.3));

          // Combine effects
          float combined = centerWave * 0.3 + rotatingField * 0.3 + energyFlow * 0.2 + noisePattern * 0.2;
          combined = combined * 0.5 + 0.5;

          // Color gradient - aura effect
          vec3 colorInner = vec3(0.2, 0.4, 0.7);
          vec3 colorMid = vec3(0.1, 0.6, 0.8);
          vec3 colorOuter = vec3(0.05, 0.3, 0.5);

          vec3 color = mix(colorInner, colorMid, combined);
          color = mix(color, colorOuter, distFromCenter * 0.8);

          // Add mouse interaction
          color = mix(color, vec3(0.3, 0.8, 0.95), mouseAura * 0.5);

          // Smooth transition to black
          color *= (1.0 - smoothstep(0.8, 1.8, distFromCenter));

          gl_FragColor = vec4(color, 1.0);
        }
      `;

      function createShader(type: number, src: string) {
        if (!gl) throw new Error("WebGL context not found");
        const s = gl.createShader(type);
        if (!s) throw new Error("Failed to create shader");

        gl.shaderSource(s, src);
        gl.compileShader(s);

        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          const error = gl.getShaderInfoLog(s);
          gl.deleteShader(s);
          const shaderType = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
          throw new Error(`${shaderType} shader compilation failed: ${error}`);
        }

        return s;
      }

      let prog;
      try {
        prog = gl.createProgram();
        if (!prog) throw new Error("Failed to create WebGL program");

        const vs_shader = createShader(gl.VERTEX_SHADER, vs);
        const fs_shader = createShader(gl.FRAGMENT_SHADER, fs);

        gl.attachShader(prog, vs_shader);
        gl.attachShader(prog, fs_shader);
        gl.linkProgram(prog);

        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          const error = gl.getProgramInfoLog(prog);
          gl.deleteProgram(prog);
          throw new Error(`Program linking failed: ${error}`);
        }

        gl.useProgram(prog);
      } catch (shaderError) {
        const error = new ShaderError(
          `Shader compilation failed: ${shaderError instanceof Error ? shaderError.message : String(shaderError)}`,
          { component: "AuraEnergyShader", shaderError: String(shaderError) },
          requestId
        );
        logError(error, requestId);
        setWebglError(error);
        observer.disconnect();
        return;
      }

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
    } catch (error) {
      const shaderError = new ShaderError(
        `WebGL initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        { component: "AuraEnergyShader", originalError: String(error) },
        requestId
      );
      logError(shaderError, requestId);
      setWebglError(shaderError);
      return () => {};
    }
  }, []);

  if (webglError) {
    return (
      <div
        className="absolute inset-0 w-full h-full z-0"
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1e3a8a 100%)",
        }}
      />
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full z-0">
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}
