# Phase 2: Monitoring & Logging with Sentry

## Overview

Phase 2 has been successfully implemented! This phase adds comprehensive error tracking, performance monitoring, and structured logging to the Personal Psychologist app using Sentry.

**Status**: ✅ Complete and Production-Ready

---

## Quick Links

| Document | Purpose |
|----------|---------|
| **[QUICK_START_SENTRY.md](./QUICK_START_SENTRY.md)** | 1-minute setup guide - start here! |
| **[SENTRY_SETUP.md](./SENTRY_SETUP.md)** | Comprehensive setup and configuration |
| **[MONITORING_EXAMPLES.md](./MONITORING_EXAMPLES.md)** | Code examples for all features |
| **[PHASE2_IMPLEMENTATION_SUMMARY.md](./PHASE2_IMPLEMENTATION_SUMMARY.md)** | Technical overview |
| **[IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)** | Verification checklist |

---

## What's New

### 1. Error Tracking
- Unhandled exceptions automatically captured
- React component errors caught by error boundary
- Promise rejections handled globally
- Network and database errors tracked
- Full error context with breadcrumbs

### 2. Performance Monitoring
- **Web Vitals**: LCP, FID, CLS automatically tracked
- **API Performance**: Response times logged
- **Custom Metrics**: Track anything important
- **Database Performance**: Query timing tracked
- **Resource Initialization**: Load times measured

### 3. Structured Logging
```typescript
import { logger } from "@/lib/logging/logger";

logger.info("User logged in");
logger.trackAction("chat_submitted", "user-action");
logger.trackApiCall("/api/chat", "POST", 234, 200);
logger.trackRagRetrieval(query, chunks, duration);
```

### 4. Data Privacy
- **No user messages logged** - message content stays private
- **Anonymous sessions** - sessionId only, no personal data
- **Auto-sanitization** - auth headers and secrets filtered
- **Privacy-first design** - crisis detection logged safely

---

## Installation

### Step 1: Dependencies (Already Done)
Sentry packages are already in `package.json`:
```bash
npm install
```

### Step 2: Configuration
Create a Sentry account and get your DSN:

```bash
# Add to .env.local
SENTRY_DSN="https://your-dsn@sentry.io/project-id"
NEXT_PUBLIC_SENTRY_DSN="https://your-dsn@sentry.io/project-id"
SENTRY_ENVIRONMENT="development"
```

### Step 3: Run
```bash
npm run dev
```

---

## Architecture

```
Sentry Monitoring System
├── Server-Side (sentry.server.config.ts)
│   ├── Node.js integration
│   ├── HTTP request tracking
│   ├── Exception/rejection handling
│   └── Request sanitization
│
├── Client-Side (sentry.client.config.ts)
│   ├── React integration
│   ├── Error boundary
│   ├── Web Vitals tracking
│   └── Breadcrumb collection
│
├── Logging Layer (src/lib/logging/logger.ts)
│   ├── Multi-level logging
│   ├── Context management
│   ├── Action tracking
│   └── Performance metrics
│
├── Performance Monitoring (src/lib/monitoring/)
│   ├── Timer utilities
│   ├── Web Vitals
│   ├── API performance
│   └── Custom metrics
│
└── Integration Points
    ├── React Error Boundary
    ├── Chat API monitoring
    ├── Layout initialization
    └── Global error handlers
```

---

## Usage Examples

### Log Messages
```typescript
import { logger } from "@/lib/logging/logger";

logger.debug("Debug information");
logger.info("Operation started");
logger.warn("Unusual behavior detected");
logger.error("Error occurred", error);
```

### Track Actions
```typescript
logger.trackAction("chat_submitted", "user-action", {
  messageLength: 142,
});
```

### Monitor Performance
```typescript
import { PerformanceTimer } from "@/lib/monitoring/performance";

const timer = new PerformanceTimer("operation");
// ... do work ...
timer.end(); // Automatically logged
```

### API Monitoring
```typescript
logger.trackApiCall("/api/chat", "POST", 234, 200);
```

### Error Handling
```typescript
import { SentryErrorBoundary } from "@/components/SentryErrorBoundary";

<SentryErrorBoundary fallback={<ErrorFallback />}>
  <YourComponent />
</SentryErrorBoundary>
```

---

## Key Features

### Automatic Tracking
- Web Vitals (LCP, FID, CLS)
- Unhandled errors
- API response times
- User navigation
- Component errors

### Manual Tracking
- Custom metrics
- User actions
- Database operations
- RAG retrieval
- Crisis detection (safe)

### Breadcrumbs
- Chat submissions
- Shader switches
- Page navigation
- API calls
- Crisis triggers

### Context Management
- Request ID injection
- Session context
- User actions
- Performance data
- Error metadata

---

## Integration with Other Phases

### Phase 1: Error Handling
✓ Compatible with existing error middleware
✓ Complements console logging
✓ Adds cloud-based error tracking

### Phase 3: Rate Limiting
✓ Ready for rate limit event tracking
✓ Logger breadcrumbs available
✓ API monitoring integrated

### Phase 4: Performance Optimization
✓ Bottleneck data collected
✓ Baseline metrics available
✓ Regression detection ready

---

## Files Created

### Configuration (3 files)
- `sentry.server.config.ts` - Server initialization
- `sentry.client.config.ts` - Client initialization
- `src/instrumentation.ts` - Next.js hook

### Utilities (3 files)
- `src/lib/logging/logger.ts` - Logging system
- `src/lib/monitoring/performance.ts` - Performance tracking
- `src/lib/monitoring/apiMonitoring.ts` - API monitoring

### Components (2 files)
- `src/components/SentryErrorBoundary.tsx` - Error boundary
- `src/components/RootLayoutWrapper.tsx` - Layout wrapper

### Hooks (1 file)
- `src/hooks/useSentryInit.ts` - Client initialization

### Documentation (5+ files)
- `QUICK_START_SENTRY.md`
- `SENTRY_SETUP.md`
- `MONITORING_EXAMPLES.md`
- `PHASE2_IMPLEMENTATION_SUMMARY.md`
- `IMPLEMENTATION_CHECKLIST.md`

---

## Configuration

### Environment Variables
```env
# Required for Sentry to work
SENTRY_DSN="https://..."
NEXT_PUBLIC_SENTRY_DSN="https://..."

# Environment selection
SENTRY_ENVIRONMENT="development"        # dev, staging, production

# Performance sampling
SENTRY_TRACES_SAMPLE_RATE="1.0"         # 1.0 for dev, 0.1 for prod

# Optional
SENTRY_RELEASE="1.0.0"                  # Version/commit hash
```

### Sample Rates
- **Development**: 1.0 (capture 100%)
- **Production**: 0.1 (capture 10% to reduce costs)

### Disabling Sentry
Remove DSN from environment to gracefully disable:
```bash
# No Sentry events sent
SENTRY_DSN=""
NEXT_PUBLIC_SENTRY_DSN=""
```

---

## Monitoring Dashboard

In Sentry, you can see:
- **Issues**: All errors and crashes
- **Performance**: Slow transactions
- **Releases**: Errors by version
- **Breadcrumbs**: User actions before errors
- **Replays**: Session recordings (optional)

---

## Best Practices

1. **Set context early**
   ```typescript
   logger.setContext({ sessionId: "123" });
   ```

2. **Track performance metrics**
   ```typescript
   logger.trackPerformance("metric_name", value, "ms");
   ```

3. **Use appropriate log levels**
   - `debug`: Development debugging
   - `info`: General information
   - `warn`: Potential issues
   - `error`: Errors that need attention

4. **Never log user content**
   - No messages
   - No personal data
   - No passwords/tokens

5. **Tag errors for filtering**
   - Use tags to group related errors
   - Makes debugging easier

---

## Troubleshooting

### Events not showing up?
1. Check DSN is correct
2. Check browser console for errors
3. Verify network tab shows Sentry requests
4. Check Sentry project settings for filters

### High error volume?
1. Reduce sample rate
2. Configure error grouping
3. Add error filtering rules

### Performance issues?
1. Lower traces sample rate
2. Disable session replay
3. Use selective transaction creation

---

## Testing

### Verify Setup
```bash
# Install dependencies
npm install

# Build succeeds
npm run build

# Start dev server
npm run dev
```

### Test Error Tracking
```typescript
// In browser console
throw new Error("Test error");

// Should appear in Sentry dashboard within seconds
```

### Test Performance Tracking
- Open DevTools → Network → Look for Sentry requests
- Check browser console for initialization logs
- View Sentry dashboard → Performance tab

---

## Security & Privacy

### Data Privacy
- ✅ No user messages logged
- ✅ No personal data collected
- ✅ Anonymous session IDs only
- ✅ Auth headers filtered
- ✅ Sensitive fields removed

### Security Features
- ✅ beforeSend hook sanitization
- ✅ TLS encryption to Sentry
- ✅ No hardcoded credentials
- ✅ Environment variable based config

---

## Support

### Documentation
- **Quick Start**: [QUICK_START_SENTRY.md](./QUICK_START_SENTRY.md)
- **Full Guide**: [SENTRY_SETUP.md](./SENTRY_SETUP.md)
- **Examples**: [MONITORING_EXAMPLES.md](./MONITORING_EXAMPLES.md)
- **API Reference**: [SENTRY_SETUP.md#api-reference](./SENTRY_SETUP.md#api-reference)

### External Resources
- [Sentry Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Dashboard](https://sentry.io)
- [Issue Tracker](https://github.com/getsentry/sentry-nextjs)

---

## Next Steps

### This Week
1. Create Sentry account
2. Create Next.js project
3. Get DSN
4. Add to .env.local
5. Run npm install && npm run dev

### Before Production
1. Configure production DSN
2. Set sample rate to 0.1
3. Configure alert rules
4. Test Slack notifications
5. Deploy to staging
6. Monitor for issues

### Ongoing
1. Review Sentry dashboard daily
2. Address critical issues quickly
3. Monitor performance trends
4. Adjust sample rates as needed
5. Keep team trained on alerts

---

## Metrics to Track

### Errors
- Error rate by endpoint
- Error rate by component
- Most common errors
- Error trends over time

### Performance
- API response times
- Web Vitals (LCP, FID, CLS)
- Database query performance
- Resource initialization time

### User Actions
- Most common user paths
- User interaction patterns
- Feature usage
- Error locations

---

## Roadmap

### Completed (Phase 2)
- ✅ Sentry SDK installed
- ✅ Server-side initialization
- ✅ Client-side initialization
- ✅ Logger utility
- ✅ Error boundary
- ✅ Performance monitoring
- ✅ API monitoring
- ✅ Documentation

### Upcoming (Phase 3 & 4)
- ⏳ Rate limiting monitoring
- ⏳ Performance optimization based on metrics
- ⏳ Alert rules configuration
- ⏳ Release tracking automation
- ⏳ Dashboard customization

---

## Summary

Phase 2 provides a production-ready monitoring and logging system with:
- Complete error tracking across client and server
- Performance monitoring with Web Vitals
- Structured logging with context management
- Privacy-first design (no user content)
- Full integration with Next.js
- Comprehensive documentation
- Easy-to-use APIs

Start with [QUICK_START_SENTRY.md](./QUICK_START_SENTRY.md) to get up and running in minutes!

---

**Status**: ✅ Ready for Production
**Last Updated**: 2026-06-15
**Documentation**: Complete
**Testing**: Verified
