"use client";

import React from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Error Boundary wrapper using Sentry
 * Catches React component errors and reports them to Sentry
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class SentryErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    console.error("[SentryErrorBoundary] Caught error:", error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="max-w-md mx-auto p-6 bg-slate-800/50 rounded-lg border border-red-900/30">
              <h1 className="text-xl font-semibold text-red-400 mb-2">
                Something went wrong
              </h1>
              <p className="text-slate-300 text-sm mb-4">
                We've logged this error. Please refresh the page to try again.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with Sentry error boundary
 */
export function withSentryErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <SentryErrorBoundary fallback={fallback}>
      <Component {...props} />
    </SentryErrorBoundary>
  );

  WrappedComponent.displayName = `withSentryErrorBoundary(${
    Component.displayName || Component.name || "Component"
  })`;

  return WrappedComponent;
}
