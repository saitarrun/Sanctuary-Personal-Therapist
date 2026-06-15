# Quick Start: Sentry Monitoring

## 1-Minute Setup

### Step 1: Create Sentry Account
1. Go to https://sentry.io
2. Sign up (free tier available)
3. Create a new Next.js project
4. Copy your DSN

### Step 2: Configure Environment
Add to `.env.local`:

```env
SENTRY_DSN="your-dsn-here"
NEXT_PUBLIC_SENTRY_DSN="your-dsn-here"
SENTRY_ENVIRONMENT="development"
NEXT_PUBLIC_SENTRY_ENVIRONMENT="development"
```

### Step 3: Install & Start
```bash
npm install
npm run dev
```

Done! Sentry is now monitoring your app.

## Usage Examples

### Log Messages
```typescript
import { logger } from "@/lib/logging/logger";

logger.info("User logged in");
logger.error("Something went wrong", error);
logger.trackAction("chat_submitted", "user-action");
```

### Track API Performance
```typescript
logger.trackApiCall("/api/chat", "POST", 234, 200);
```

### Track RAG Retrieval
```typescript
logger.trackRagRetrieval(query, numChunks, duration);
```

### Monitor Performance
```typescript
import { PerformanceTimer } from "@/lib/monitoring/performance";

const timer = new PerformanceTimer("operation");
// Do work...
timer.end(); // Logged automatically
```

### Handle Component Errors
```typescript
import { SentryErrorBoundary } from "@/components/SentryErrorBoundary";

<SentryErrorBoundary>
  <YourComponent />
</SentryErrorBoundary>
```

## Key Features

✅ **Error Tracking**: Catches all unhandled errors
✅ **Performance Monitoring**: Tracks Web Vitals and API response times
✅ **Structured Logging**: Organized logs with context
✅ **User Actions**: Breadcrumbs of what users did before errors
✅ **Crisis Detection**: Safe logging of safety system triggers
✅ **Privacy**: No user messages or personal data sent

## Common Tasks

### View Errors
1. Go to Sentry dashboard
2. Click "Issues"
3. See all errors and crashes

### Check Performance
1. Go to Sentry dashboard
2. Click "Performance"
3. See slow requests and bottlenecks

### Set Up Alerts
1. Go to Sentry dashboard
2. Settings → Alerts
3. Create new alert rule
4. Choose Slack or email notification

### Track Release
Set in `.env`:
```env
SENTRY_RELEASE="1.0.0"
```

## Environment-Specific Config

### Development
```env
SENTRY_TRACES_SAMPLE_RATE="1.0"    # Capture everything
```

### Production
```env
SENTRY_ENVIRONMENT="production"
SENTRY_TRACES_SAMPLE_RATE="0.1"    # Capture 10% (reduce costs)
```

## Disable Locally
```env
SENTRY_DSN=""
NEXT_PUBLIC_SENTRY_DSN=""
```

Sentry will disable itself gracefully.

## File Locations

| Purpose | Location |
|---------|----------|
| Server Config | `sentry.server.config.ts` |
| Client Config | `sentry.client.config.ts` |
| Logger | `src/lib/logging/logger.ts` |
| Error Boundary | `src/components/SentryErrorBoundary.tsx` |
| Performance | `src/lib/monitoring/performance.ts` |
| API Monitoring | `src/lib/monitoring/apiMonitoring.ts` |
| Setup Guide | `SENTRY_SETUP.md` |
| Examples | `MONITORING_EXAMPLES.md` |

## Troubleshooting

**Events not showing up?**
1. Check DSN in `.env`
2. Open browser DevTools → Network
3. Look for Sentry requests
4. Check browser console for errors

**High error volume?**
1. Reduce sample rate: `SENTRY_TRACES_SAMPLE_RATE="0.1"`
2. Configure error grouping in Sentry
3. Add error filtering rules

**Performance issues?**
1. Lower sample rate in production
2. Disable session replay: `replaysSessionSampleRate: 0`

## Next Steps

1. ✅ DSN configured
2. ✅ npm install
3. ✅ npm run dev
4. ⬜ View errors in Sentry dashboard
5. ⬜ Set up Slack alerts
6. ⬜ Configure release tracking
7. ⬜ Deploy to production

## Resources

- **Setup**: `SENTRY_SETUP.md`
- **Examples**: `MONITORING_EXAMPLES.md`
- **Full Docs**: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Sentry Dashboard**: https://sentry.io

## API Cheat Sheet

```typescript
// Logging
logger.debug(msg, data)
logger.info(msg, data)
logger.warn(msg, data)
logger.error(msg, error, data)

// Context
logger.setContext({ sessionId: "123" })
logger.clearContext()
logger.getRequestId()

// Tracking
logger.trackAction(name, category, data)
logger.trackApiCall(endpoint, method, duration, status)
logger.trackPerformance(metric, value, unit, tags)
logger.trackRagRetrieval(query, chunks, duration)
logger.trackDbOperation(op, table, duration, success)
logger.trackCrisisDetection(triggered, reason)

// Performance
new PerformanceTimer(name).end()
trackWebVitals()
trackApiResponse(method, endpoint, duration, status)
```

---

**Need help?** See `SENTRY_SETUP.md` for detailed documentation.
