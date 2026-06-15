"use client";

import { ReactNode, useState, useEffect } from "react";
import { logError, ShaderError, generateRequestId } from "@/lib/errors/errorHandler";
import { ErrorBoundary } from "./ErrorBoundary";

interface ShaderWrapperProps {
  children: ReactNode;
  name: string;
  fallbackGradient?: string;
}

/**
 * Fallback UI for when a shader fails to render.
 * Displays a simple CSS gradient instead of WebGL.
 */
function ShaderFallback({
  name,
  gradient,
  retry,
}: {
  name: string;
  gradient: string;
  retry: () => void;
}) {
  return (
    <div
      className="w-full h-full absolute inset-0"
      style={{
        background: gradient,
        transition: "opacity 0.3s ease-in-out",
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
        <button
          onClick={retry}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
        >
          Retry {name}
        </button>
      </div>
    </div>
  );
}

/**
 * Wrapper component for shader visualizations.
 * Catches WebGL initialization errors and provides graceful fallbacks.
 * Prevents shader failures from crashing the entire page.
 */
export function ShaderWrapper({
  children,
  name,
  fallbackGradient = "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
}: ShaderWrapperProps) {
  const [hasError, setHasError] = useState(false);
  const [requestId] = useState(() => generateRequestId());

  useEffect(() => {
    // Listen for WebGL context loss (out of memory, driver issue, etc.)
    const handleWebGLContextLoss = () => {
      const error = new ShaderError(
        `WebGL context lost for ${name}. Possible causes: out of memory, driver issue, or browser limitations.`,
        { shaderName: name },
        requestId
      );
      logError(error, requestId);
      setHasError(true);
    };

    const canvases = document.querySelectorAll("canvas");
    canvases.forEach((canvas) => {
      canvas.addEventListener("webglcontextlost", handleWebGLContextLoss);
    });

    return () => {
      canvases.forEach((canvas) => {
        canvas.removeEventListener("webglcontextlost", handleWebGLContextLoss);
      });
    };
  }, [name, requestId]);

  const handleError = (error: Error) => {
    const shaderError = new ShaderError(
      `Failed to render ${name}: ${error.message}`,
      { shaderName: name, originalError: error.message },
      requestId
    );
    logError(shaderError, requestId);
    setHasError(true);
  };

  const handleRetry = () => {
    setHasError(false);
  };

  if (hasError) {
    return (
      <ShaderFallback
        name={name}
        gradient={fallbackGradient}
        retry={handleRetry}
      />
    );
  }

  return (
    <ErrorBoundary
      onError={handleError}
      fallback={(error, retry) => (
        <ShaderFallback
          name={name}
          gradient={fallbackGradient}
          retry={() => {
            retry();
            setHasError(false);
          }}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
