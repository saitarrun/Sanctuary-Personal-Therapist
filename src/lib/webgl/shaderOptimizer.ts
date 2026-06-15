/**
 * WebGL shader optimization utilities for performance.
 * Handles frame rate capping, GPU memory monitoring, and shader compilation.
 */

import { getMonitor } from "@/lib/performance/monitor";

export interface ShaderConfig {
  maxFPS: number; // Default: 60
  memoryWarningMB: number; // Default: 500
  enableStats: boolean; // Show FPS/memory stats (debug)
}

/**
 * Frame rate limiter using requestAnimationFrame scheduling
 */
export class FrameRateLimiter {
  private maxFPS: number;
  private frameTimeMs: number;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private lastFpsUpdate: number = 0;

  constructor(maxFPS: number = 60) {
    this.maxFPS = maxFPS;
    this.frameTimeMs = 1000 / maxFPS;
  }

  /**
   * Check if enough time has passed to render the next frame
   */
  shouldRender(now: number): boolean {
    if (now - this.lastFrameTime >= this.frameTimeMs) {
      this.lastFrameTime = now;
      this.frameCount++;

      // Update FPS every second
      if (now - this.lastFpsUpdate >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastFpsUpdate = now;

        // Log if FPS drops below 30
        if (this.fps < 30) {
          console.warn(
            `[Shader] Low FPS detected: ${this.fps} FPS (target: ${this.maxFPS})`
          );
          getMonitor().recordShaderRenderTime(this.frameTimeMs);
        }
      }

      return true;
    }
    return false;
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.fps || this.maxFPS;
  }

  /**
   * Set new max FPS (for adaptive quality)
   */
  setMaxFPS(maxFPS: number) {
    this.maxFPS = maxFPS;
    this.frameTimeMs = 1000 / maxFPS;
  }
}

/**
 * GPU memory monitoring for WebGL contexts
 */
export class GPUMemoryMonitor {
  private warningMB: number;
  private hasWarned: boolean = false;

  constructor(warningMB: number = 500) {
    this.warningMB = warningMB;
  }

  /**
   * Check GPU memory usage (only available in some browsers)
   */
  checkMemory(): number {
    // Use WebGL extension if available
    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      try {
        // @ts-ignore - gpu is not in standard types
        const memory = navigator.gpu?.memory;
        if (memory) {
          const usedMB = memory.used / 1024 / 1024;
          const totalMB = memory.total / 1024 / 1024;

          if (usedMB > this.warningMB && !this.hasWarned) {
            console.warn(
              `[GPU] High memory usage: ${usedMB.toFixed(
                1
              )}MB / ${totalMB.toFixed(1)}MB`
            );
            this.hasWarned = true;
          }

          return usedMB;
        }
      } catch (err) {
        // GPU monitoring not available
      }
    }

    return 0;
  }

  /**
   * Set new warning threshold (in MB)
   */
  setWarningMB(mb: number) {
    this.warningMB = mb;
    this.hasWarned = false;
  }
}

/**
 * Shader compilation error handling
 */
export function compileShader(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error("[Shader] Failed to create shader");
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  // Check compilation status
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    console.error(
      `[Shader] Compilation error (${type === gl.VERTEX_SHADER ? "vertex" : "fragment"}): ${error}`
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Create and link a WebGL program with error handling
 */
export function createProgram(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) {
    console.error("[Shader] Failed to create program");
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  // Check link status
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    console.error(`[Shader] Program linking error: ${error}`);
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

/**
 * Detect WebGL2 support and return appropriate context
 */
export function getWebGLContext(
  canvas: HTMLCanvasElement,
  webgl2Preferred: boolean = true
): WebGL2RenderingContext | WebGLRenderingContext | null {
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;

  // Try WebGL2 first if preferred
  if (webgl2Preferred) {
    gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    if (gl) {
      console.log("[Shader] Using WebGL2");
      return gl;
    }
  }

  // Fall back to WebGL1
  gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
  if (gl) {
    console.log("[Shader] Using WebGL 1");
    return gl;
  }

  // Try legacy context
  gl = canvas.getContext("experimental-webgl") as WebGLRenderingContext | null;
  if (gl) {
    console.log("[Shader] Using experimental WebGL");
    return gl;
  }

  console.error("[Shader] WebGL not supported");
  return null;
}

/**
 * Fallback canvas when WebGL is unavailable
 */
export function createFallbackCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0a0e27"; // Dark background color
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas;
}
