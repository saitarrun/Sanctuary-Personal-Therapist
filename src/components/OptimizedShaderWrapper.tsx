/**
 * Optimized shader wrapper with lazy loading, error handling, and performance monitoring.
 * Provides frame rate capping, GPU memory monitoring, and fallback rendering.
 */

"use client";

import React, { Suspense, lazy, ComponentType, ReactNode, useEffect, useRef } from "react";
import {
  FrameRateLimiter,
  GPUMemoryMonitor,
  getWebGLContext,
  createFallbackCanvas,
} from "@/lib/webgl/shaderOptimizer";

interface OptimizedShaderProps {
  component: ComponentType<any>;
  fallback?: ReactNode;
  enableStats?: boolean;
  maxFPS?: number;
  memoryWarningMB?: number;
}

/**
 * Fallback loading spinner
 */
function ShaderLoadingFallback() {
  return (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
    </div>
  );
}

/**
 * Error boundary for shader rendering
 */
class ShaderErrorBoundary extends React.Component<
  { children: ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; onError?: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("[Shader] Error boundary caught:", error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-center p-4">
          <p className="text-red-400 mb-2">Shader rendering unavailable</p>
          <p className="text-gray-400 text-sm">Your browser may not support WebGL</p>
          <div className="mt-4 w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Optimized shader component with performance features
 */
export function OptimizedShaderWrapper({
  component: ShaderComponent,
  fallback = <ShaderLoadingFallback />,
  enableStats = false,
  maxFPS = 60,
  memoryWarningMB = 500,
}: OptimizedShaderProps) {
  const statsRef = useRef<HTMLDivElement>(null);
  const frameRateLimiter = useRef(new FrameRateLimiter(maxFPS));
  const gpuMonitor = useRef(new GPUMemoryMonitor(memoryWarningMB));

  useEffect(() => {
    // Update performance monitoring every frame
    if (enableStats && statsRef.current) {
      const fps = frameRateLimiter.current.getFPS();
      statsRef.current.textContent = `FPS: ${fps}`;
    }

    // Check GPU memory periodically
    const memoryCheckInterval = setInterval(() => {
      gpuMonitor.current.checkMemory();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(memoryCheckInterval);
  }, [enableStats]);

  return (
    <ShaderErrorBoundary>
      <Suspense fallback={fallback}>
        <div className="relative w-full h-full">
          <ShaderComponent
            frameRateLimiter={frameRateLimiter.current}
            gpuMonitor={gpuMonitor.current}
          />
          {enableStats && (
            <div
              ref={statsRef}
              className="absolute top-2 right-2 text-cyan-400 text-xs font-mono bg-black/50 px-2 py-1 rounded"
            />
          )}
        </div>
      </Suspense>
    </ShaderErrorBoundary>
  );
}

/**
 * Lazy load shader components to reduce initial bundle size
 */
export function createLazyShader(
  importFn: () => Promise<{ [key: string]: ComponentType<any> }>,
  exportName: string = "default"
) {
  return lazy(() =>
    importFn().then((module) => ({
      default: module[exportName],
    }))
  );
}
