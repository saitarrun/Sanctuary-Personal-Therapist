"use client";

import React, { ReactNode, useState, useCallback } from "react";
import { logError, generateRequestId } from "@/lib/errors/errorHandler";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  requestId: string;
}

/**
 * React Error Boundary to catch component errors and prevent page crashes.
 * Displays a fallback UI with retry button and logs errors for monitoring.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  private requestId: string;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.requestId = generateRequestId();
    this.state = {
      hasError: false,
      error: null,
      requestId: this.requestId,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Log the error for monitoring (Sentry will be integrated in Phase 2)
    logError(error, this.requestId);

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log component stack for debugging
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-900 to-slate-950 rounded-lg border border-slate-700">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              We encountered an error while rendering this component. Your session is safe—please try again.
            </p>
            <p className="text-xs text-slate-500 mb-6">
              Request ID: <code className="bg-slate-800 px-2 py-1 rounded">{this.state.requestId}</code>
            </p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Functional component version for use in client components with hooks.
 * Wraps the Error Boundary class component.
 */
export function ErrorBoundaryProvider({
  children,
  fallback,
  onError,
}: ErrorBoundaryProps) {
  return (
    <ErrorBoundary fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundary>
  );
}
