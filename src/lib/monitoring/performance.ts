import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logging/logger";

/**
 * Performance monitoring utilities
 * Tracks API performance, Web Vitals, and custom metrics
 */

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
}

/**
 * Start a performance timer that automatically tracks on completion
 */
export class PerformanceTimer {
  private name: string;
  private startTime: number;
  private tags: Record<string, string>;

  constructor(name: string, tags?: Record<string, string>) {
    this.name = name;
    this.startTime = performance.now();
    this.tags = tags || {};
  }

  /**
   * End the timer and log the duration
   */
  end(): number {
    const duration = performance.now() - this.startTime;
    logger.trackPerformance(this.name, Math.round(duration), "ms", this.tags);
    return duration;
  }

  /**
   * Mark an intermediate point and log the duration
   */
  mark(label: string): number {
    const duration = performance.now() - this.startTime;
    logger.trackPerformance(`${this.name}:${label}`, Math.round(duration), "ms", {
      ...this.tags,
      checkpoint: label,
    });
    return duration;
  }
}

/**
 * Track Web Vitals (LCP, FID, CLS)
 * Should be called in a useEffect on the client
 */
export function trackWebVitals(): void {
  if (typeof window === "undefined") return;

  // Largest Contentful Paint
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === "largest-contentful-paint") {
        const paint = entry as any;
        logger.trackPerformance(
          "LCP (Largest Contentful Paint)",
          Math.round(paint.renderTime || paint.loadTime),
          "ms"
        );
      }
    }
  });

  try {
    observer.observe({ entryTypes: ["largest-contentful-paint"] });
  } catch (e) {
    // PerformanceObserver not supported
  }

  // Cumulative Layout Shift
  let clsValue = 0;
  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === "layout-shift") {
        const shift = entry as any;
        if (!shift.hadRecentInput) {
          clsValue += shift.value;
        }
      }
    }
  });

  try {
    clsObserver.observe({ entryTypes: ["layout-shift"] });

    // Report CLS on visibility change
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") {
          logger.trackPerformance(
            "CLS (Cumulative Layout Shift)",
            Math.round(clsValue * 10000) / 10000
          );
        }
      },
      true
    );
  } catch (e) {
    // PerformanceObserver not supported
  }

  // First Input Delay (via web-vitals library or manual tracking)
  document.addEventListener("pointerdown", trackFirstInputDelay);
  document.addEventListener("keydown", trackFirstInputDelay);
}

/**
 * Track first input delay
 */
let fidTracked = false;
function trackFirstInputDelay(): void {
  if (fidTracked) return;
  fidTracked = true;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === "first-input") {
        const input = entry as any;
        const fid = input.processingDuration;
        logger.trackPerformance("FID (First Input Delay)", Math.round(fid), "ms");
      }
    }
  });

  try {
    observer.observe({ entryTypes: ["first-input"] });
  } catch (e) {
    // PerformanceObserver not supported
  }
}

/**
 * Track API response time and status
 * Use in API routes to measure performance
 */
export function trackApiResponse(
  method: string,
  endpoint: string,
  durationMs: number,
  statusCode: number
): void {
  const level = statusCode >= 400 ? "warning" : "info";

  Sentry.captureMessage(
    `API ${method} ${endpoint} - ${statusCode} (${durationMs}ms)`,
    level
  );

  logger.trackApiCall(endpoint, method, durationMs, statusCode);
}

/**
 * Create a performance monitoring wrapper for API routes
 */
export function withPerformanceMonitoring(
  handler: Function,
  endpoint: string
): Function {
  return async (...args: any[]): Promise<any> => {
    const timer = new PerformanceTimer(`api:${endpoint}`);

    try {
      const response = await handler(...args);

      // Extract status code if available
      const statusCode = (response as any)?.status || 200;
      const duration = timer.end();

      trackApiResponse("POST", endpoint, Math.round(duration), statusCode);

      return response;
    } catch (error) {
      const duration = timer.end();
      trackApiResponse("POST", endpoint, Math.round(duration), 500);
      throw error;
    }
  };
}

/**
 * Track custom metric
 */
export function trackCustomMetric(
  metric: PerformanceMetric
): void {
  logger.trackPerformance(metric.name, metric.value, metric.unit, metric.tags);
}

/**
 * Get current performance metrics (for debugging)
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  if (typeof window === "undefined") {
    return {};
  }

  const navigation = performance.getEntriesByType(
    "navigation"
  )[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType("paint");

  return {
    dns: navigation?.domainLookupEnd - navigation?.domainLookupStart || 0,
    tcp: navigation?.connectEnd - navigation?.connectStart || 0,
    ttfb: navigation?.responseStart - navigation?.requestStart || 0,
    download: navigation?.responseEnd - navigation?.responseStart || 0,
    domContentLoaded: navigation?.domContentLoadedEventEnd || 0,
    loadComplete: navigation?.loadEventEnd || 0,
    firstPaint: paint.find((p) => p.name === "first-paint")?.startTime || 0,
    firstContentfulPaint:
      paint.find((p) => p.name === "first-contentful-paint")?.startTime || 0,
  };
}

interface PerformanceMetrics {
  [key: string]: number;
}
