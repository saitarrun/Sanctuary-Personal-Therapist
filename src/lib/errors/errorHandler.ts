/**
 * Centralized error handling and structured logging for the psychology coaching app.
 * Provides custom error classes, severity levels, and user-friendly error messages.
 */

/**
 * Severity levels for errors. Used for monitoring and alerting.
 */
export type ErrorSeverity = "critical" | "warning" | "info";

/**
 * Error types for categorization and specific handling strategies.
 */
export type ErrorType =
  | "APIError"
  | "DBError"
  | "ShaderError"
  | "ValidationError"
  | "StreamError"
  | "RateLimitError"
  | "NotFoundError"
  | "UnknownError";

/**
 * Structured error object for logging and monitoring (Sentry-compatible).
 */
export interface StructuredError {
  type: ErrorType;
  message: string;
  severity: ErrorSeverity;
  statusCode: number;
  requestId?: string;
  timestamp: string;
  originalError?: Error;
  context?: Record<string, unknown>;
}

/**
 * Base custom error class with structured logging.
 */
export class CoachError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly statusCode: number;
  public readonly requestId?: string;
  public readonly timestamp: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    type: ErrorType,
    message: string,
    severity: ErrorSeverity = "warning",
    statusCode: number = 500,
    context?: Record<string, unknown>,
    requestId?: string
  ) {
    super(message);
    this.type = type;
    this.severity = severity;
    this.statusCode = statusCode;
    this.context = context;
    this.requestId = requestId;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, CoachError.prototype);
  }

  /**
   * Convert to structured error format (Sentry-compatible).
   */
  toStructured(): StructuredError {
    return {
      type: this.type,
      message: this.message,
      severity: this.severity,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      requestId: this.requestId,
      context: this.context,
      originalError: this,
    };
  }
}

/**
 * API errors (external service failures, network issues).
 */
export class APIError extends CoachError {
  constructor(
    message: string,
    statusCode: number = 502,
    context?: Record<string, unknown>,
    requestId?: string
  ) {
    super("APIError", message, "warning", statusCode, context, requestId);
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Database errors (connection, query, transaction failures).
 */
export class DBError extends CoachError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    requestId?: string
  ) {
    super("DBError", message, "critical", 503, context, requestId);
    Object.setPrototypeOf(this, DBError.prototype);
  }
}

/**
 * Shader/WebGL errors (compilation, context issues).
 */
export class ShaderError extends CoachError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    requestId?: string
  ) {
    super("ShaderError", message, "info", 200, context, requestId);
    Object.setPrototypeOf(this, ShaderError.prototype);
  }
}

/**
 * Input validation errors (bad request data).
 */
export class ValidationError extends CoachError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    requestId?: string
  ) {
    super("ValidationError", message, "info", 400, context, requestId);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Stream encoding/transmission errors.
 */
export class StreamError extends CoachError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    requestId?: string
  ) {
    super("StreamError", message, "warning", 500, context, requestId);
    Object.setPrototypeOf(this, StreamError.prototype);
  }
}

/**
 * Rate limit errors.
 */
export class RateLimitError extends CoachError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    requestId?: string
  ) {
    super("RateLimitError", message, "warning", 429, context, requestId);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Not found errors (resource doesn't exist).
 */
export class NotFoundError extends CoachError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    requestId?: string
  ) {
    super("NotFoundError", message, "info", 404, context, requestId);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Mapping of error types to user-friendly messages.
 * Never expose stack traces or technical details to users.
 */
const USER_FRIENDLY_MESSAGES: Record<ErrorType, string> = {
  APIError: "The service is temporarily unavailable. Please try again in a moment.",
  DBError: "We're having trouble accessing our database. Please try again.",
  ShaderError: "Your browser doesn't support advanced graphics. Using a simpler display instead.",
  ValidationError: "The information you provided isn't valid. Please check and try again.",
  StreamError: "We lost the connection while streaming your response. Please refresh and try again.",
  RateLimitError: "You're sending requests too quickly. Please wait a moment and try again.",
  NotFoundError: "The resource you're looking for doesn't exist.",
  UnknownError: "Something unexpected happened. Please try again later.",
};

/**
 * Log structured error data (compatible with Sentry and other monitoring tools).
 */
export function logError(error: StructuredError | Error, requestId?: string): void {
  let structured: StructuredError;

  if (error instanceof CoachError) {
    structured = error.toStructured();
  } else if (error instanceof Error) {
    structured = {
      type: "UnknownError",
      message: error.message,
      severity: "warning",
      statusCode: 500,
      timestamp: new Date().toISOString(),
      requestId,
      originalError: error,
    };
  } else {
    structured = {
      type: "UnknownError",
      message: String(error),
      severity: "critical",
      statusCode: 500,
      timestamp: new Date().toISOString(),
      requestId,
    };
  }

  // Log with severity and type for filtering in monitoring tools
  const logLevel =
    structured.severity === "critical"
      ? console.error
      : structured.severity === "warning"
        ? console.warn
        : console.log;

  logLevel(
    `[${structured.type}] ${structured.message}`,
    {
      severity: structured.severity,
      statusCode: structured.statusCode,
      timestamp: structured.timestamp,
      requestId: structured.requestId,
      context: structured.context,
    }
  );
}

/**
 * Get user-friendly error message based on error type.
 * Safe to display to users (no technical details).
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof CoachError) {
    return USER_FRIENDLY_MESSAGES[error.type];
  }
  return USER_FRIENDLY_MESSAGES.UnknownError;
}

/**
 * Determine HTTP status code from error.
 */
export function getStatusCode(error: unknown): number {
  if (error instanceof CoachError) {
    return error.statusCode;
  }
  if (error instanceof Error) {
    return 500;
  }
  return 500;
}

/**
 * Generate a unique request ID for error tracing.
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
