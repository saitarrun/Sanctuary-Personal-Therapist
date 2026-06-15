"use client";

import { useEffect, useRef } from "react";

export function NeuralConstellationShader() {
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

      // Hash for node positions
      vec2 hash2(vec2 p) {
        return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
      }

      float nodeDistance(vec2 p, vec2 nodePos) {
        return length(p - nodePos);
      }

      void main() {
        vec2 uv = v_texCoord;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.0001;

        vec3 color = vec3(0.01, 0.02, 0.04);

        // Neural network grid
        vec2 gridSize = vec2(6.0, 4.0);
        vec2 cellPos = floor(p * gridSize);

        // Draw nodes and connections
        for(int y = -2; y <= 2; y++) {
          for(int x = -2; x <= 2; x++) {
            vec2 nodeGridPos = cellPos + vec2(float(x), float(y));
            vec2 nodeWorldPos = nodeGridPos / gridSize;

            // Add dynamic offset
            vec2 offset = hash2(nodeGridPos) * 2.0 - 1.0;
            offset *= sin(t + length(nodeGridPos) * 0.5) * 0.1;
            nodeWorldPos += offset * 0.1;

            float dist = distance(p, nodeWorldPos);

            // Draw node glow
            float node = exp(-dist * 8.0) * 0.6;
            node *= (sin(t + length(nodeGridPos) * 0.3) * 0.5 + 0.7);

            vec3 nodeColor = mix(
              vec3(0.1, 0.4, 0.6),
              vec3(0.2, 0.7, 0.9),
              sin(length(nodeGridPos) * 0.5 + t) * 0.5 + 0.5
            );

            color += nodeColor * node * 0.4;

            // Draw connections to nearest neighbors
            for(int dy = -1; dy <= 1; dy++) {
              for(int dx = -1; dx <= 1; dx++) {
                if(dx == 0 && dy == 0) continue;

                vec2 neighborGridPos = nodeGridPos + vec2(float(dx), float(dy));
                vec2 neighborWorldPos = neighborGridPos / gridSize;

                vec2 neighborOffset = hash2(neighborGridPos) * 2.0 - 1.0;
                neighborOffset *= sin(t + length(neighborGridPos) * 0.5) * 0.1;
                neighborWorldPos += neighborOffset * 0.1;

                // Line from node to neighbor
                vec2 lineStart = nodeWorldPos;
                vec2 lineEnd = neighborWorldPos;
                vec2 lineDir = normalize(lineEnd - lineStart);
                vec2 perpDir = vec2(-lineDir.y, lineDir.x);

                float distToLine = abs(dot(p - lineStart, perpDir));
                float distAlongLine = dot(p - lineStart, lineDir);

                float lineLength = distance(lineStart, lineEnd);
                float normalizedDist = distAlongLine / lineLength;

                float line = 0.0;
                if(normalizedDist >= -0.1 && normalizedDist <= 1.1) {
                  line = exp(-distToLine * 15.0) * (1.0 - abs(normalizedDist - 0.5) * 2.0) * 0.5;
                  line *= (sin(t * 2.0 + normalizedDist * 5.0) * 0.5 + 0.7);
                }

                vec3 lineColor = vec3(0.15, 0.5, 0.7);
                color += lineColor * line * 0.3;
              }
            }
          }
        }

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
