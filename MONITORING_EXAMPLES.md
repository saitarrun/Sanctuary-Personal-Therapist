# Monitoring & Logging Examples

This document provides practical examples of how to use the Sentry monitoring and logging system in your code.

## Table of Contents
1. [API Route Monitoring](#api-route-monitoring)
2. [Component Error Tracking](#component-error-tracking)
3. [Performance Tracking](#performance-tracking)
4. [Custom Logging](#custom-logging)
5. [User Action Tracking](#user-action-tracking)
6. [Database Operation Tracking](#database-operation-tracking)

## API Route Monitoring

### Basic API Route with Monitoring

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withApiMonitoring, createApiSpan } from "@/lib/monitoring/apiMonitoring";
import { logger } from "@/lib/logging/logger";
import { prisma } from "@/lib/db";

async function handler(req: NextRequest): Promise<NextResponse> {
  const { span, end } = createApiSpan("example_operation", "Process example data");

  try {
    // Initialize context
    logger.setContext({
      sessionId: req.nextUrl.searchParams.get("sessionId") || undefined,
    });

    // Perform work with monitoring
    const data = await prisma.example.findMany();

    end({ recordCount: data.length, success: true });
    logger.info("Example operation completed", { recordCount: data.length });

    return NextResponse.json({ data });
  } catch (error) {
    end({ success: false, error: error instanceof Error ? error.message : "Unknown" });
    logger.error("Example operation failed", error as Error);
    throw error;
  }
}

// Wrap with monitoring
export const POST = withApiMonitoring(handler, "POST /api/example");
```

### Chat API with RAG and Crisis Detection

The chat API route already includes comprehensive monitoring:

```typescript
// Already implemented in src/app/api/chat/route.ts:

// 1. RAG retrieval tracking
const ragStartTime = Date.now();
try {
  chunks = await retrieve(message);
  const ragDuration = Date.now() - ragStartTime;
  logger.trackRagRetrieval(message, chunks.length, ragDuration);
} catch (error) {
  logger.error("[chat] RAG retrieval failed", error as Error, {
    sessionId,
    message_length: message.length,
  });
}

// 2. Crisis detection logging
const crisis = detectCrisis(message);
if (crisis.triggered) {
  logger.trackCrisisDetection(true, crisis.reason || "Unknown");
}
```

## Component Error Tracking

### Component with Error Boundary

```typescript
// src/components/ChatInterface.tsx
"use client";

import React from "react";
import { SentryErrorBoundary } from "@/components/SentryErrorBoundary";

export function ChatInterface() {
  return (
    <SentryErrorBoundary fallback={<ChatErrorFallback />}>
      <ChatContent />
    </SentryErrorBoundary>
  );
}

function ChatErrorFallback() {
  return (
    <div className="error-message">
      The chat interface encountered an error. Please refresh.
    </div>
  );
}

function ChatContent() {
  // Component content
  return <div>Chat Interface</div>;
}
```

### Using Error Boundary HOC

```typescript
// src/components/ShaderViewer.tsx
import { withSentryErrorBoundary } from "@/components/SentryErrorBoundary";

function ShaderViewerComponent() {
  // Component implementation
  return <canvas />;
}

// Wrap component with error boundary
export default withSentryErrorBoundary(ShaderViewerComponent);
```

## Performance Tracking

### Performance Timer for Operations

```typescript
// src/components/ShaderGallery.tsx
"use client";

import { PerformanceTimer } from "@/lib/monitoring/performance";
import { useEffect, useState } from "react";

export function ShaderGallery() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = new PerformanceTimer("shader_gallery_init", {
      gallery: "main",
    });

    // Initialize shaders
    initializeShaders();

    timer.mark("shaders_loaded");

    // Load additional assets
    loadAssets();

    timer.mark("assets_loaded");

    const totalDuration = timer.end();
    console.log(`Gallery initialized in ${totalDuration}ms`);

    setLoading(false);
  }, []);

  return <div>{loading ? "Loading..." : "Gallery"}</div>;
}
```

### API Call Performance Tracking

```typescript
// src/lib/api/client.ts
import { trackApiResponse } from "@/lib/monitoring/performance";

async function fetchChatResponse(sessionId: string, message: string) {
  const startTime = performance.now();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message }),
    });

    const duration = performance.now() - startTime;

    // Track performance
    trackApiResponse("POST", "/api/chat", Math.round(duration), response.status);

    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    trackApiResponse("POST", "/api/chat", Math.round(duration), 500);
    throw error;
  }
}
```

### Web Vitals Monitoring (Already Automatic)

Web Vitals are automatically tracked in `useSentryInit()`:

```typescript
// Automatically tracked:
// - LCP (Largest Contentful Paint)
// - FID (First Input Delay)
// - CLS (Cumulative Layout Shift)

// View results in Sentry dashboard:
// Performance → Web Vitals
```

## Custom Logging

### Structured Logging Examples

```typescript
// src/lib/example.ts
import { logger } from "@/lib/logging/logger";

export async function exampleOperation(sessionId: string) {
  // Set context for all subsequent logs
  logger.setContext({ sessionId });

  // Debug logging (development)
  logger.debug("Starting operation", { timestamp: new Date().toISOString() });

  try {
    // Info logging
    logger.info("Processing data", { itemCount: 42 });

    // Perform work...

    logger.info("Operation completed successfully");
  } catch (error) {
    // Error logging with context
    logger.error("Operation failed", error as Error, {
      sessionId,
      stage: "processing",
    });
    throw error;
  }

  // Clear context when done (optional)
  logger.clearContext();
}
```

### Warning-Level Logs

```typescript
// src/lib/validation.ts
import { logger } from "@/lib/logging/logger";

export function validateInput(input: string): boolean {
  if (input.length > 10000) {
    logger.warn("Input exceeds recommended size", {
      inputLength: input.length,
      threshold: 10000,
    });
  }

  return input.length > 0;
}
```

## User Action Tracking

### Chat Submission Tracking

```typescript
// src/components/ChatInput.tsx
"use client";

import { useState } from "react";
import { logger } from "@/lib/logging/logger";

export function ChatInput({ sessionId }: { sessionId: string }) {
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Track user action
    logger.trackAction("chat_submitted", "user-action", {
      sessionId,
      messageLength: message.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message }),
      });

      if (response.ok) {
        logger.info("Chat message sent successfully");
        setMessage("");
      } else {
        logger.warn("Chat message submission failed", {
          status: response.status,
        });
      }
    } catch (error) {
      logger.error("Chat submission error", error as Error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message..."
      />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Shader Switch Tracking

```typescript
// src/components/ShaderSelector.tsx
"use client";

import { useState } from "react";
import { logger } from "@/lib/logging/logger";

export function ShaderSelector() {
  const [selectedShader, setSelectedShader] = useState("default");

  const handleShaderChange = (shaderId: string) => {
    // Track shader switch
    logger.trackAction("shader_switched", "visualization", {
      fromShader: selectedShader,
      toShader: shaderId,
    });

    setSelectedShader(shaderId);
  };

  return (
    <select value={selectedShader} onChange={(e) => handleShaderChange(e.target.value)}>
      <option value="default">Default</option>
      <option value="particle">Particle Flow</option>
      <option value="crystal">Crystal Geometry</option>
    </select>
  );
}
```

### Page Navigation Tracking

```typescript
// Automatically tracked in useSentryInit():
// logger.trackAction("page_view", "navigation", {
//   pathname: window.location.pathname
// });

// For custom navigation:
import { logger } from "@/lib/logging/logger";
import { useRouter } from "next/navigation";

export function NavigationExample() {
  const router = useRouter();

  const navigateTo = (path: string) => {
    logger.trackAction("navigation", "navigation", {
      from: window.location.pathname,
      to: path,
    });

    router.push(path);
  };

  return (
    <button onClick={() => navigateTo("/shaders")}>View Shaders</button>
  );
}
```

## Database Operation Tracking

### Tracking Database Queries

```typescript
// src/lib/db/operations.ts
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logging/logger";

export async function getSessionMessages(sessionId: string) {
  const startTime = Date.now();

  try {
    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });

    const duration = Date.now() - startTime;
    logger.trackDbOperation("findMany", "message", duration, true);

    return messages;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.trackDbOperation("findMany", "message", duration, false);
    logger.error("Failed to fetch session messages", error as Error);
    throw error;
  }
}

export async function createMessage(
  sessionId: string,
  role: string,
  content: string
) {
  const startTime = Date.now();

  try {
    const message = await prisma.message.create({
      data: { sessionId, role, content },
    });

    const duration = Date.now() - startTime;
    logger.trackDbOperation("create", "message", duration, true);

    return message;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.trackDbOperation("create", "message", duration, false);
    logger.error("Failed to create message", error as Error);
    throw error;
  }
}
```

## Error Scenarios

### Capturing Custom Errors

```typescript
// src/lib/features/analysis.ts
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logging/logger";

export async function analyzeContent(content: string) {
  const requestId = logger.getRequestId();

  try {
    // Validation
    if (!content || content.length === 0) {
      const error = new Error("Content is empty");
      Sentry.captureException(error, {
        tags: { type: "validation" },
        contexts: { operation: { requestId, operation: "analyzeContent" } },
      });
      throw error;
    }

    // Analysis
    const result = await performAnalysis(content);

    logger.info("Content analysis completed", { resultLength: result.length });
    return result;
  } catch (error) {
    logger.error("Content analysis failed", error as Error, {
      requestId,
      contentLength: content.length,
    });

    // Re-throw for upstream handling
    throw error;
  }
}

async function performAnalysis(content: string) {
  // Implementation
  return content;
}
```

## Testing

### Unit Test with Logger Mocking

```typescript
// src/lib/__tests__/example.test.ts
import { describe, it, expect, vi } from "vitest";
import { logger } from "@/lib/logging/logger";

describe("exampleFunction", () => {
  it("logs info when successful", async () => {
    const infoSpy = vi.spyOn(logger, "info");

    // await exampleFunction();

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining("success"),
      expect.any(Object)
    );
  });

  it("logs error when failed", async () => {
    const errorSpy = vi.spyOn(logger, "error");

    // await exampleFunction(); // that fails

    expect(errorSpy).toHaveBeenCalled();
  });
});
```

## Best Practices

1. **Always set context** when starting operations that span multiple functions
2. **Track performance** for any operation > 100ms
3. **Use appropriate log levels** (debug, info, warn, error)
4. **Include relevant data** but never include user messages or PII
5. **Use breadcrumbs** for sequential operations
6. **Flush logs** before critical operations complete
7. **Tag errors** for easy filtering in Sentry
8. **Monitor alert** thresholds to catch regressions

## Common Patterns

### Resource Loading Pattern

```typescript
const timer = new PerformanceTimer("resource_load", { resource: "shader" });

try {
  const resource = await loadResource();
  timer.mark("loaded");
  timer.end();
  logger.info("Resource loaded successfully");
} catch (error) {
  timer.end();
  logger.error("Resource load failed", error as Error);
}
```

### Async Operation Pattern

```typescript
const startTime = Date.now();

try {
  const result = await someAsync Operation();
  const duration = Date.now() - startTime;
  logger.trackPerformance("operation_name", duration);
  return result;
} catch (error) {
  const duration = Date.now() - startTime;
  logger.error("Operation failed", error as Error, { duration });
  throw error;
}
```

### Context Lifecycle Pattern

```typescript
logger.setContext({ sessionId: "123" });

try {
  // All logs now include sessionId
  await operation1();
  await operation2();
} finally {
  logger.clearContext();
}
```
