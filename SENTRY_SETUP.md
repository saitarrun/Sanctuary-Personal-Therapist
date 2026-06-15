# Sentry Monitoring & Logging Setup

## Phase 2: Monitoring & Logging with Sentry

This document describes the implementation of error tracking, performance monitoring, and structured logging using Sentry for the Personal Psychologist app.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

The Sentry packages (`@sentry/nextjs`, `@sentry/react`) have already been added to `package.json`.

### 2. Configure Sentry DSN

1. Create a Sentry account at https://sentry.io
2. Create a new project for Next.js
3. Copy your DSN from Settings → Projects → [Your Project] → Client Keys (DSN)

4. Add to `.env.local`:

```env
# Server-side monitoring
SENTRY_DSN="https://examplePublicKey@o0.ingest.sentry.io/0"
SENTRY_ENVIRONMENT="development"
SENTRY_RELEASE="v0.1.0"
SENTRY_TRACES_SAMPLE_RATE="1.0"

# Client-side monitoring (must use NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_SENTRY_DSN="https://examplePublicKey@o0.ingest.sentry.io/0"
NEXT_PUBLIC_SENTRY_ENVIRONMENT="development"
NEXT_PUBLIC_SENTRY_RELEASE="v0.1.0"
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE="1.0"
```

### 3. Verify Installation

When you start the app, Sentry will initialize automatically:

```bash
npm run dev
```

You should see log output confirming Sentry initialization.

## Architecture

### Server-Side Configuration (`sentry.server.config.ts`)

Initializes Sentry for Node.js runtime:
- HTTP integration for tracking request handling
- Exception and rejection handling
- Request/response sanitization (removes auth headers, sensitive data)
- Performance transaction tracking

**Key Features:**
- Automatic error capturing
- Request context injection
- Sensitive data filtering

### Client-Side Configuration (`sentry.client.config.ts`)

Initializes Sentry for browser runtime:
- React integration
- Session replay (optional)
- Breadcrumb tracking (console, DOM, fetch, history)
- Web Vitals monitoring (LCP, FID, CLS)

**Key Features:**
- Error boundary integration
- User interaction tracking
- Performance metrics collection

### Instrumentation (`src/instrumentation.ts`)

Next.js lifecycle hook that runs on server startup:
- Loads `sentry.server.config.ts` in Node.js runtime
- Supports edge runtime initialization

## Key Components

### 1. Custom Logger (`src/lib/logging/logger.ts`)

Structured logging utility integrated with Sentry.

**Usage:**

```typescript
import { logger } from "@/lib/logging/logger";

// Set context for all logs
logger.setContext({
  sessionId: "session-123",
  userId: "user-456"
});

// Log messages
logger.debug("Starting operation", { key: "value" });
logger.info("Operation completed");
logger.warn("Something unexpected happened", { detail: "info" });
logger.error("An error occurred", error, { context: "data" });

// Track actions (as breadcrumbs)
logger.trackAction("chat_submitted", "user-action", {
  messageLength: 142
});

// Track API calls
logger.trackApiCall("/api/chat", "POST", 234, 200);

// Track performance
logger.trackPerformance("shader_init", 45, "ms");

// Track RAG retrieval
logger.trackRagRetrieval(userQuery, numChunks, duration);

// Track database operations
logger.trackDbOperation("query", "messages", 120, true);

// Track crisis detection
logger.trackCrisisDetection(true, "suicide_keywords");

// Flush pending events
await logger.flush(2000);
```

### 2. Error Boundary (`src/components/SentryErrorBoundary.tsx`)

React Error Boundary that catches component errors and reports to Sentry.

**Usage:**

```typescript
// Wrap components
<SentryErrorBoundary fallback={<ErrorFallback />}>
  <YourComponent />
</SentryErrorBoundary>

// Or use HOC
export default withSentryErrorBoundary(YourComponent, <ErrorFallback />);
```

### 3. Performance Monitoring

#### PerformanceTimer (`src/lib/monitoring/performance.ts`)

```typescript
import { PerformanceTimer } from "@/lib/monitoring/performance";

const timer = new PerformanceTimer("operation_name", { tag: "value" });

// Do work...

const duration = timer.end(); // Logs the duration
timer.mark("checkpoint"); // Mark intermediate points
```

#### Web Vitals Tracking

Automatically tracks:
- **LCP** (Largest Contentful Paint): When the largest visible element loads
- **FID** (First Input Delay): Time to respond to first user interaction
- **CLS** (Cumulative Layout Shift): Visual stability metric

#### API Performance Tracking

```typescript
import { trackApiResponse } from "@/lib/monitoring/performance";

trackApiResponse("POST", "/api/chat", 234, 200);
```

### 4. API Route Monitoring (`src/lib/monitoring/apiMonitoring.ts`)

Comprehensive monitoring wrapper for API routes.

**Features:**
- Automatic request/response tracking
- Performance transaction creation
- Error reporting with context
- Request ID injection (X-Request-ID header)
- Database operation tracking

**Example Implementation in Chat Route:**

```typescript
// Monitoring is already integrated in the chat route
// - RAG retrieval time tracked
// - Crisis detection logged as breadcrumb
// - Response metrics collected

logger.trackRagRetrieval(message, chunks.length, duration);
logger.trackCrisisDetection(triggered, reason);
```

### 5. Client Initialization (`src/hooks/useSentryInit.ts`)

Hook for initializing Sentry on the client side.

```typescript
export function useSentryInit(): void {
  // Initializes Web Vitals tracking
  // Sets up session context
  // Configures global error handlers
}
```

Used in `RootLayoutWrapper` component.

## Data Privacy & Security

### Sanitization

All configurations include data sanitization:

1. **Authentication Headers**: Removed before sending to Sentry
2. **Cookies**: Stripped from request/response
3. **Message Content**: Not sent as breadcrumb data
4. **Sensitive Fields**: password, token, apiKey automatically filtered

### Session Context

Uses anonymized `sessionId` instead of personal user data:

```typescript
logger.setContext({
  sessionId: "session-uuid", // Anonymous session identifier
  // NOT: userId, username, email, etc.
});
```

### Crisis Detection

Crisis triggers logged as breadcrumbs without message content:

```typescript
// Logged (safe):
logger.trackCrisisDetection(true, "suicide_keywords");

// NOT logged (content privacy):
// The actual user message is never sent to Sentry
```

## Configuration

### Environment Variables

See `.env.example` for all available options:

```env
# Server-side
SENTRY_DSN="https://..."              # Required for server-side tracking
SENTRY_ENVIRONMENT="development"      # development, staging, production
SENTRY_RELEASE="v1.0.0"               # Your app version
SENTRY_TRACES_SAMPLE_RATE="1.0"       # 0.0 to 1.0 (1.0 = 100% of requests)

# Client-side (public, use NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_SENTRY_DSN="https://..."  # Must be public DSN
NEXT_PUBLIC_SENTRY_ENVIRONMENT="development"
NEXT_PUBLIC_SENTRY_RELEASE="v1.0.0"
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE="1.0"
```

### Sample Rates

**Development:**
- `SENTRY_TRACES_SAMPLE_RATE="1.0"` - Capture 100% for detailed debugging
- Easier to see all errors and performance data

**Production:**
- `SENTRY_TRACES_SAMPLE_RATE="0.1"` - Capture 10% to reduce noise
- More cost-effective, still captures issues

### Release Tracking

Set release to your git commit hash or semantic version:

```bash
# In deployment scripts
SENTRY_RELEASE=$(git rev-parse --short HEAD)
# or
SENTRY_RELEASE="1.0.0-beta.1"
```

## Monitoring Dashboard

### What Gets Tracked

#### Errors
- Unhandled exceptions
- React component errors
- Promise rejections
- API errors (500, network failures)
- Database errors

#### Performance
- API response times
- Web Vitals (LCP, FID, CLS)
- Shader initialization time
- RAG retrieval performance
- Database query duration

#### User Actions (Breadcrumbs)
- Chat submissions
- Shader switches
- Page navigation
- API calls
- Crisis detections

#### Transactions
- Full request lifecycle
- Database operations
- RAG retrieval
- LLM provider calls

### Viewing in Sentry

1. **Issues**: View-all errors and crashes
2. **Performance**: Slow transactions and bottlenecks
3. **Releases**: Track errors by version
4. **Breadcrumbs**: See user actions before errors
5. **Replays**: Watch session replays (if enabled)

## Integration with Existing Error Handler

This Sentry setup works alongside the existing error handler (`src/lib/middleware/errorMiddleware.ts`).

**Division of Responsibility:**

- **Error Handler**: Structured logging to console/files
- **Sentry**: Cloud-based error tracking and analysis

Both systems work together for comprehensive observability.

## Testing

### Local Testing

1. Ensure DSN is set in `.env.local`
2. Start dev server: `npm run dev`
3. Trigger an error:
   ```typescript
   throw new Error("Test error");
   ```
4. Check Sentry dashboard for the error

### Disabling Sentry Locally

Remove `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` from `.env.local`:

```env
SENTRY_DSN=""
NEXT_PUBLIC_SENTRY_DSN=""
```

Sentry will gracefully disable itself when DSN is empty.

## API Reference

### Logger Methods

```typescript
logger.debug(message: string, data?: object): void
logger.info(message: string, data?: object): void
logger.warn(message: string, data?: object): void
logger.error(message: string, error?: Error, data?: object): void

logger.setContext(context: LogContext): void
logger.clearContext(): void
logger.getRequestId(): string

logger.trackAction(action: string, category?: string, data?: object): void
logger.trackApiCall(endpoint: string, method: string, durationMs: number, statusCode?: number): void
logger.trackPerformance(metric: string, value: number, unit?: string, tags?: object): void
logger.trackRagRetrieval(query: string, numChunks: number, durationMs: number): void
logger.trackDbOperation(operation: string, table: string, durationMs: number, success: boolean): void
logger.trackCrisisDetection(triggered: boolean, reason?: string): void

logger.flush(timeout?: number): Promise<boolean>
```

### Performance Methods

```typescript
// PerformanceTimer
const timer = new PerformanceTimer(name: string, tags?: object);
timer.end(): number
timer.mark(label: string): number

// Helpers
trackWebVitals(): void
trackApiResponse(method: string, endpoint: string, durationMs: number, statusCode: number): void
trackCustomMetric(metric: PerformanceMetric): void
getPerformanceMetrics(): PerformanceMetrics
```

## Troubleshooting

### Sentry Not Capturing Events

1. Check DSN is set correctly in `.env.local`
2. Verify environment is not in the `ignoreErrors` list
3. Check Sentry project settings for data filters
4. Ensure `beforeSend` hook isn't filtering the event

### High Error Volume

1. Check `ignoreErrors` configuration
2. Enable error grouping in Sentry
3. Use release tracking to correlate with deployments
4. Review breadcrumbs for context

### Performance Issues

1. Reduce `SENTRY_TRACES_SAMPLE_RATE` in production
2. Use selective transaction creation
3. Monitor Sentry quota usage

## Next Steps

1. **Staging Environment**: Configure separate Sentry project for staging
2. **Alert Rules**: Set up Slack/email alerts for critical errors
3. **Release Tracking**: Integrate with deployment pipeline
4. **Performance Baselines**: Establish metrics for monitoring regressions
5. **On-Call Rotation**: Set up issue assignment and escalation

## References

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry React Integration](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Session Replay](https://docs.sentry.io/product/session-replay/)
