# Rate Limiting & Abuse Prevention (Phase 3)

## Overview

This document describes the rate limiting and abuse prevention system implemented in Phase 3. The system protects the psychology coaching app from:

- **Session spam**: Users flooding a single session with messages
- **Session creation spam**: Attackers creating many sessions from the same IP
- **DDoS attacks**: IP addresses making excessive requests
- **Message spam**: Rapid-fire duplicate or nonsensical messages
- **Session hijacking**: Unusual patterns of access

## Architecture

### Components

1. **Rate Limiter (`src/lib/rateLimit/limiter.ts`)**
   - Token bucket algorithm implementation
   - Sliding window rate limiting
   - In-memory store (upgradeable to Redis)
   - O(1) lookup time

2. **Request Utils (`src/lib/rateLimit/requestUtils.ts`)**
   - IP extraction (handles X-Forwarded-For, X-Real-IP, Cloudflare)
   - Session ID extraction from body/cookies
   - IP anonymization for GDPR compliance

3. **Message Validator (`src/lib/validation/messageValidator.ts`)**
   - Rapid-fire message detection (>3 messages in 5 seconds)
   - Duplicate message detection
   - Excessive punctuation detection
   - Message history tracking per session

4. **Middleware (`src/middleware.ts`)**
   - Intercepts all API requests
   - Applies rate limits before handler execution
   - Returns 429 Too Many Requests with Retry-After header
   - Fail-safe: allows request if limiter fails

## Configuration

Rate limits are configured via environment variables:

```env
# Enable/disable rate limiting globally
RATE_LIMIT_ENABLED=true

# Messages per session per minute
RATE_LIMIT_MESSAGE_PER_MIN=20

# Session creations per IP per hour
RATE_LIMIT_SESSION_PER_HOUR=10

# Total requests per IP per hour
RATE_LIMIT_IP_PER_HOUR=100
```

### Development vs. Production

- **Development**: Set `RATE_LIMIT_ENABLED=false` to bypass limits during testing
- **Production**: Keep all rate limits enabled with recommended defaults

## Rate Limit Tiers

### Message Level (Per Session)
- **Limit**: 20 messages per minute
- **Window**: 60 seconds
- **Purpose**: Prevents single-session spam
- **Applies to**: POST /api/chat
- **Applied by**: Middleware + Route handler

### Session Level (Per IP)
- **Limit**: 10 new sessions per hour
- **Window**: 3600 seconds (1 hour)
- **Purpose**: Prevents session creation spam
- **Applies to**: POST /api/sessions
- **Applied by**: Middleware + Route handler

### IP Level (Global)
- **Limit**: 100 requests per hour
- **Window**: 3600 seconds (1 hour)
- **Purpose**: Prevents DDoS-style attacks
- **Applies to**: All POST requests
- **Applied by**: Middleware

### Endpoint Level (Per Endpoint)
- **Chat endpoint**: 50 requests per minute (per IP)
- **Sessions endpoint**: 10 requests per minute (per IP)
- **Purpose**: Prevents endpoint-specific abuse
- **Applied by**: Middleware

## Message Validation

Beyond rate limiting, messages are validated for content patterns:

### Rapid-Fire Detection
- **Trigger**: >3 messages from same session in 5 seconds
- **Action**: Reject message with user-friendly message
- **Exception**: Crisis messages are NOT rate-limited

### Duplicate Detection
- **Trigger**: Exact duplicate within 2 seconds
- **Detection**: Case-insensitive comparison
- **Action**: Reject with "avoid repeating" message

### Special Character Detection
- **Trigger**: 3+ groups of double/triple punctuation marks
- **Examples**: "!!! ??? !!!" would trigger
- **Action**: Reject with "excessive special characters" message

## API Response Headers

All rate-limited endpoints return these headers:

```
RateLimit-Limit: 20           # Total limit
RateLimit-Remaining: 15       # Requests remaining
RateLimit-Reset: 1718531234   # Unix timestamp (seconds) when quota resets
Retry-After: 45               # Seconds to wait (only when rate limited)
```

## HTTP Status Codes

- **200 OK**: Request succeeded
- **201 Created**: Session created successfully
- **400 Bad Request**: Invalid input or validation error (includes message validation errors)
- **429 Too Many Requests**: Rate limit exceeded
  - Includes `Retry-After` header
  - Returns JSON: `{ error: "...", retryAfter: 45 }`

## Implementation Details

### Token Bucket Algorithm

The token bucket algorithm works as follows:

1. Each key (session ID, IP, endpoint) has a bucket of tokens
2. Tokens refill at a constant rate: `maxRequests / windowMs`
3. Each request consumes 1 token
4. If no tokens remain, request is denied
5. Tokens don't exceed the maximum (no "hoarding")

**Example**: For 20 messages/minute (60,000ms):
- Refill rate: 20 / 60,000 = 0.000333 tokens/ms
- After 30 seconds: 10 tokens refilled
- After 60 seconds: All 20 tokens refilled

### IP Extraction

The middleware safely extracts client IP from:

1. `X-Forwarded-For` header (first value if multiple)
2. `X-Real-IP` header
3. `CF-Connecting-IP` (Cloudflare)
4. Direct connection IP (fallback)

This is safe for cloud deployments (Vercel, Netlify, etc.).

### IP Anonymization

For GDPR/privacy compliance, IPs are anonymized in logs:
- IPv4: `192.168.1.xxx`
- IPv6: `2001:db8:85a3:xxx`

### Fail-Safe Design

If rate limiting logic fails:
- Middleware allows the request (fail-open)
- Error is logged for debugging
- App continues to function

This prevents rate limiting from causing denial of service itself.

## Crisis Message Handling

Crisis messages (suicidal ideation, self-harm, abuse) are:
- **NOT rate-limited** at the message level
- **Still subject to** IP and endpoint limits (for DDoS prevention)
- **Detected by**: Crisis detector before validation
- **Purpose**: Never block help-seeking in crisis

## Monitoring & Logging

### Logged Events

Rate limit violations are logged:

```
[rate-limit] IP 192.168.1.xxx exceeded rate limit for endpoint /api/chat
[rate-limit] Session <id> exceeded message rate limit
[rate-limit] middleware error: [error details]
```

Use logs to identify:
- Legitimate users hitting limits (may need adjustment)
- Coordinated spam attacks (multiple IPs hitting same endpoint)
- Suspicious patterns (high failure rates)

### Integration with Sentry (Phase 2)

Rate limit violations should be reported to Sentry for trend analysis:

```typescript
import * as Sentry from "@sentry/nextjs";

if (!rateLimitResult.allowed) {
  Sentry.captureMessage("Rate limit exceeded", "warning", {
    tags: { type: "rate_limit", endpoint },
    extra: { ip: anonymizeIP(ip), sessionId },
  });
}
```

## Testing

### Unit Tests

Run rate limiter tests:

```bash
npm test -- src/lib/rateLimit/limiter.test.ts
npm test -- src/lib/validation/messageValidator.test.ts
```

### Manual Testing

**Disable rate limiting locally:**
```env
RATE_LIMIT_ENABLED=false
```

**Test via curl:**

```bash
# Chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-123", "message": "Hello"}'

# Sessions endpoint
curl -X POST http://localhost:3000/api/sessions
```

**Check rate limit headers:**

```bash
curl -I -X POST http://localhost:3000/api/sessions
```

Look for `RateLimit-*` headers in response.

## Future Improvements

### Redis Backend
Currently uses in-memory storage. For distributed systems:

```typescript
// Future: Switch to Redis-based limiter
import { createRedisLimiter } from "@/lib/rateLimit/redis";
```

### Adaptive Limits
Monitor actual usage patterns and adjust limits:

```typescript
// Future: Detect and allow burst traffic
const limit = getAdaptiveLimit(ipAddress, timeOfDay);
```

### Session State Tracking
Detect and prevent session hijacking:

```typescript
// Future: Track IP changes per session
const isValidIP = await validateSessionIP(sessionId, currentIP);
```

### Captcha Integration
When rate limits are hit, require captcha:

```typescript
// Future: Use hCaptcha for human verification
const captchaValid = await verifyCaptcha(token);
```

## Security Considerations

### What This Protects Against
- Spam and abuse (same user/IP)
- DDoS attacks (many requests from single IP)
- Session creation spam
- Message flooding

### What This Does NOT Protect Against
- **Distributed attacks**: Multiple IPs coordinating (need WAF)
- **Sophisticated bots**: Can bypass rate limits with randomization
- **Endpoint logic flaws**: Rate limiting doesn't fix broken auth
- **Database attacks**: Rate limiting on POST only (need parameterized queries)

### Always Remember
- Rate limiting is ONE layer of defense
- Combine with: authentication, authorization, input validation, WAF
- Monitor and respond to violations
- Adjust limits based on real user behavior

## Troubleshooting

### "Too many requests" when developing
**Solution**: Set `RATE_LIMIT_ENABLED=false` in `.env`

### Legitimate users hitting limits
**Solution**: Increase limits in `.env`:
```env
RATE_LIMIT_MESSAGE_PER_MIN=30  # Instead of 20
RATE_LIMIT_SESSION_PER_HOUR=20  # Instead of 10
```

### Rate limits not applying
**Solution**: Check:
1. `RATE_LIMIT_ENABLED=true` in `.env`
2. Request is POST (GET requests are exempt)
3. Middleware file exists at `src/middleware.ts`
4. No errors in server logs

### False positives (legitimate spam detection)
**Example**: User legitimately sends same message twice
**Solution**: Adjust window or exception in `messageValidator.ts`

## Files

- `src/lib/rateLimit/limiter.ts` - Core rate limiting logic
- `src/lib/rateLimit/requestUtils.ts` - IP/session extraction
- `src/lib/rateLimit/index.ts` - Public API exports
- `src/lib/validation/messageValidator.ts` - Message spam detection
- `src/middleware.ts` - Request interception and rate limit checks
- `src/app/api/chat/route.ts` - Chat endpoint with validation
- `src/app/api/sessions/route.ts` - Sessions endpoint with limits
- `src/lib/config.ts` - Configuration schema with rate limit env vars
- `.env.example` - Documentation of rate limit variables
- `RATE_LIMITING.md` - This file

## References

- Token Bucket Algorithm: https://en.wikipedia.org/wiki/Token_bucket
- HTTP Rate Limiting Standards: RFC 6585 (429 Too Many Requests)
- Next.js Middleware: https://nextjs.org/docs/advanced-features/middleware
- GDPR IP Handling: https://gdpr-info.eu/
