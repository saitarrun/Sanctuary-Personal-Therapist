/**
 * API error middleware for Next.js route handlers.
 * Wraps handler execution with error catching and structured response formatting.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  CoachError,
  logError,
  getUserFriendlyMessage,
  getStatusCode,
  generateRequestId,
  DBError,
  APIError,
} from "@/lib/errors/errorHandler";

// Re-export for convenience
export { generateRequestId };

/**
 * Structured error response sent to clients.
 */
export interface ErrorResponse {
  error: string;
  status: number;
  requestId: string;
  timestamp: string;
}

/**
 * Wrap a Next.js route handler with error handling and structured logging.
 *
 * Usage:
 * ```
 * export const POST = withErrorHandler(async (req: NextRequest) => {
 *   // Your handler logic
 * });
 * ```
 */
export function withErrorHandler(
  handler: (
    req: NextRequest,
    requestId: string
  ) => Promise<NextResponse | Response>
) {
  return async (req: NextRequest) => {
    const requestId = generateRequestId();

    try {
      return await handler(req, requestId);
    } catch (error) {
      return handleAPIError(error, requestId);
    }
  };
}

/**
 * Handle API errors with consistent response format.
 */
export function handleAPIError(error: unknown, requestId: string): NextResponse<ErrorResponse> {
  let statusCode = 500;
  let userMessage = "An unexpected error occurred. Please try again.";

  // Log the error for monitoring
  if (error instanceof CoachError) {
    logError(error, requestId);
    statusCode = error.statusCode;
    userMessage = getUserFriendlyMessage(error);
  } else if (error instanceof Error) {
    // Log unexpected errors
    logError(error, requestId);
    statusCode = getStatusCode(error);
    userMessage = getUserFriendlyMessage(error);
  } else {
    // Handle non-Error objects
    console.error("[API Error] Unexpected error type:", error);
  }

  const response: ErrorResponse = {
    error: userMessage,
    status: statusCode,
    requestId,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Retry helper for transient failures (database connections, rate limits, etc.).
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Graceful stream error handler.
 * Safely closes a ReadableStream controller and logs the error.
 */
export function handleStreamError(
  controller: ReadableStreamDefaultController<Uint8Array>,
  error: unknown,
  requestId: string
): void {
  if (error instanceof CoachError) {
    logError(error, requestId);
  } else if (error instanceof Error) {
    logError(error, requestId);
  } else {
    console.error("[Stream Error] Unexpected error type:", error);
  }

  try {
    controller.close();
  } catch (closeError) {
    console.error("[Stream Error] Failed to close stream:", closeError);
  }
}
