"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { trackWebVitals } from "@/lib/monitoring/performance";
import { logger } from "@/lib/logging/logger";

/**
 * Hook to initialize Sentry on the client side
 * Sets up error tracking, performance monitoring, and Web Vitals
 * Should be called once in the root layout or app component
 */

export function useSentryInit(): void {
  useEffect(() => {
    // Initialize client-side Sentry
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      // Client config is already initialized in _app or layout wrapper
      logger.info("Sentry client initialized", {
        environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN?.substring(0, 20) + "...",
      });
    }

    // Track Web Vitals
    trackWebVitals();

    // Set up user context if available (from session)
    const sessionId = getSessionIdFromStorage();
    if (sessionId) {
      Sentry.setContext("session", { sessionId });
      logger.setContext({ sessionId });
    }

    // Track page view
    logger.trackAction("page_view", "navigation", {
      pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
    });

    // Set up global error handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logger.error("Unhandled promise rejection", event.reason);
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);
}

/**
 * Get session ID from localStorage
 */
function getSessionIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem("sessionId");
  } catch (e) {
    return null;
  }
}
