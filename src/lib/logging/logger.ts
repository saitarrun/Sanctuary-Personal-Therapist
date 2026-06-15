import * as Sentry from "@sentry/nextjs";

/**
 * Structured logging utility that integrates with Sentry
 * Provides consistent logging across the application with breadcrumb tracking
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  sessionId?: string;
  userId?: string;
  [key: string]: unknown;
}

class Logger {
  private context: LogContext = {};

  constructor() {
    // Initialize context with request ID if not provided
    if (!this.context.requestId) {
      this.context.requestId = this.generateRequestId();
    }
  }

  /**
   * Set context for subsequent logs
   */
  setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
    // Update Sentry context
    Sentry.setContext("logger", {
      ...this.context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = { requestId: this.generateRequestId() };
  }

  /**
   * Get current request ID
   */
  getRequestId(): string {
    return this.context.requestId || this.generateRequestId();
  }

  /**
   * Debug level logging
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  /**
   * Info level logging
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  /**
   * Error level logging
   */
  error(
    message: string,
    error?: Error | Record<string, unknown>,
    data?: Record<string, unknown>
  ): void {
    if (error instanceof Error) {
      Sentry.captureException(error, {
        contexts: {
          logger: {
            message,
            ...this.context,
          },
        },
        extra: data,
      });
    }
    this.log("error", message, {
      ...(error instanceof Error
        ? { errorMessage: error.message, errorStack: error.stack }
        : error),
      ...data,
    });
  }

  /**
   * Track a user action as a breadcrumb
   */
  trackAction(
    action: string,
    category: string = "user-action",
    data?: Record<string, unknown>
  ): void {
    Sentry.captureMessage(action, "info");
    Sentry.addBreadcrumb({
      category,
      message: action,
      level: "info",
      data: {
        requestId: this.context.requestId,
        ...data,
      },
    });
  }

  /**
   * Track API call with timing
   */
  trackApiCall(
    endpoint: string,
    method: string,
    durationMs: number,
    statusCode?: number,
    error?: string
  ): void {
    const level = statusCode && statusCode >= 400 ? "warning" : "info";
    Sentry.addBreadcrumb({
      category: "api",
      message: `${method} ${endpoint}`,
      level,
      data: {
        endpoint,
        method,
        durationMs,
        statusCode,
        error,
        requestId: this.context.requestId,
      },
    });
  }

  /**
   * Track performance metric
   */
  trackPerformance(
    metric: string,
    value: number,
    unit: string = "ms",
    tags?: Record<string, string>
  ): void {
    Sentry.captureMessage(`Performance: ${metric} = ${value}${unit}`, "info");
    Sentry.addBreadcrumb({
      category: "performance",
      message: metric,
      level: "info",
      data: {
        value,
        unit,
        ...tags,
        requestId: this.context.requestId,
      },
    });
  }

  /**
   * Track crisis detection (without storing actual content)
   */
  trackCrisisDetection(triggered: boolean, reason?: string): void {
    if (triggered) {
      Sentry.addBreadcrumb({
        category: "crisis",
        message: "Crisis detected",
        level: "warning",
        data: {
          triggered,
          reason,
          sessionId: this.context.sessionId,
          requestId: this.context.requestId,
        },
      });
    }
  }

  /**
   * Track RAG retrieval
   */
  trackRagRetrieval(
    query: string,
    numChunks: number,
    durationMs: number
  ): void {
    Sentry.addBreadcrumb({
      category: "rag",
      message: `Retrieved ${numChunks} chunks`,
      level: "info",
      data: {
        numChunks,
        durationMs,
        queryLength: query.length,
        requestId: this.context.requestId,
      },
    });
  }

  /**
   * Track database operation
   */
  trackDbOperation(
    operation: string,
    table: string,
    durationMs: number,
    success: boolean
  ): void {
    Sentry.addBreadcrumb({
      category: "database",
      message: `${operation} on ${table}`,
      level: success ? "info" : "warning",
      data: {
        operation,
        table,
        durationMs,
        success,
        requestId: this.context.requestId,
      },
    });
  }

  /**
   * Flush any pending logs to Sentry
   */
  async flush(timeout: number = 2000): Promise<boolean> {
    return await Sentry.flush(timeout);
  }

  // Private methods

  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      requestId: this.context.requestId,
      ...data,
    };

    // Console output (development)
    const consoleMethod =
      level === "error" ? console.error : console[level] || console.log;
    consoleMethod(`[${timestamp}] [${level.toUpperCase()}]`, message, data);

    // Sentry breadcrumb
    Sentry.addBreadcrumb({
      category: "log",
      message,
      level: level as Sentry.SeverityLevel,
      data: {
        ...data,
        requestId: this.context.requestId,
      },
    });
  }

  private generateRequestId(): string {
    // Use crypto.randomUUID if available, fallback to uuid v4
    try {
      const { randomUUID } = require("crypto");
      return randomUUID();
    } catch {
      // Fallback implementation for generating a UUID-like string
      return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Create a child logger with preset context
 */
export function createLogger(context: LogContext): Logger {
  const childLogger = new Logger();
  childLogger.setContext(context);
  return childLogger;
}
