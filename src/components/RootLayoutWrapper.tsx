"use client";

import React from "react";
import { useSentryInit } from "@/hooks/useSentryInit";
import { SentryErrorBoundary } from "@/components/SentryErrorBoundary";

/**
 * Root layout wrapper component
 * Initializes Sentry and wraps children with error boundary
 */

interface RootLayoutWrapperProps {
  children: React.ReactNode;
}

export function RootLayoutWrapper({ children }: RootLayoutWrapperProps): React.ReactElement {
  // Initialize Sentry on client side
  useSentryInit();

  return (
    <SentryErrorBoundary>
      {children}
    </SentryErrorBoundary>
  );
}
