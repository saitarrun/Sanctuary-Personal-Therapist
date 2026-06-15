# Phase 7 Quick Reference Guide

**TL;DR**: Session management with JWT tokens, refresh token rotation, CSRF protection, and anomaly detection.

---

## Core Concepts

### 1. JWT (Access Token)
- **Duration**: 15 minutes
- **Storage**: Memory (client-side)
- **Transmission**: `Authorization: Bearer <token>` header
- **Signature**: HS256 with JWT_SECRET
- **Contains**: userId, sessionId, iat, exp, ver

### 2. Refresh Token
- **Duration**: 7 days
- **Storage**: HttpOnly cookie (secure)
- **Transmission**: Automatic in cookies
- **Hash**: SHA-256 stored in DB
- **Rotation**: Single-use, new token on refresh

### 3. CSRF Token
- **Duration**: 1 day
- **Storage**: Regular cookie + client state
- **Transmission**: `X-CSRF-Token` header
- **Purpose**: Protect against CSRF on POST/PUT/DELETE

### 4. AuthSession
- **Per**: User + Device
- **Tracks**: Device name, IP, location, activity
- **Expires**: 7 days or on logout
- **Revokable**: Single session or all sessions

---

## Key Files to Implement

### Week 1 Priority
```
src/lib/auth/types.ts                    # Types & interfaces
src/lib/security/securityConfig.ts       # Constants
src/lib/security/tokenManager.ts         # JWT generation
src/lib/security/refreshTokenManager.ts  # Token rotation
src/lib/security/sessionManager.ts       # Session CRUD
src/lib/security/csrfProtection.ts       # CSRF tokens
```

### Week 2 Priority
```
src/lib/security/anomalyDetector.ts      # Anomaly detection
src/lib/middleware/authMiddleware.ts     # JWT validation
src/lib/middleware/csrfMiddleware.ts     # CSRF validation
src/app/api/auth/login/route.ts          # Login endpoint
src/app/api/auth/logout/route.ts         # Logout endpoint
src/app/api/auth/refresh/route.ts        # Token refresh
```

### Week 3 Priority
```
src/app/api/auth/sessions/route.ts       # List sessions
src/lib/monitoring/authMonitoring.ts     # Sentry tracking
API route updates for JWT auth
Database migrations
```

---

## Database Models

### RefreshToken
```prisma
- id: CUID (primary key)
- authSessionId: FK (session)
- tokenHash: String (unique, SHA-256)
- rotationCount: Int (audit)
- familyId: String (breach detection)
- isRevoked: Boolean
- expiresAt: DateTime
```

### SessionAnomalyLog
```prisma
- id: CUID
- authSessionId, userId: FKs
- anomalyType: impossible_travel, rapid_device_change, etc.
- severity: info, warning, critical
- metadata: JSON
- detectedAt: DateTime
```

### Extend AuthSession
```prisma
+ refreshTokens: RefreshToken[]
+ anomalyLogs: SessionAnomalyLog[]
+ riskScore: Int (0-100)
+ mfaRequired: Boolean (for Phase 8)
```

### Extend Session
```prisma
+ userId: String (FK to User)
```

---

## API Routes

### Public Routes (No Auth Required)

**GET /api/auth/csrf**
- Returns CSRF token
- Response: `{ csrfToken: "..." }`

**POST /api/auth/login**
- Login with email/password
- Response: `{ accessToken, csrfToken, user, requiresMfa }`
- Cookies: `refreshToken` (httpOnly), `csrfToken`

### Protected Routes (JWT Required)

**POST /api/auth/logout**
- Revoke current session
- Response: `{ message: "Logged out" }`

**POST /api/auth/refresh**
- Get new access token
- Response: `{ accessToken }`
- Cookies: New `refreshToken`

**GET /api/auth/sessions**
- List user's devices/sessions
- Response: `{ sessions: [...] }`

**DELETE /api/auth/sessions/[sessionId]**
- Revoke specific device
- Response: `{ message: "Session revoked" }`

---

## Security Features Checklist

- [ ] JWT tokens signed with HS256
- [ ] Refresh tokens hashed (SHA-256) in DB
- [ ] HttpOnly cookies for refresh tokens
- [ ] SameSite=Strict cookie flags
- [ ] CSRF token validation on POST/PUT/DELETE
- [ ] Device fingerprinting on login
- [ ] Geolocation checking for anomalies
- [ ] Impossible travel detection (>900 km/h)
- [ ] Rapid device switching detection (>3 in 15min)
- [ ] Rate limiting on auth endpoints
- [ ] All events logged to AuditLog
- [ ] Sentry monitoring integrated
- [ ] Token refresh rotation (single-use)
- [ ] Token family tracking (breach detection)
- [ ] MFA requirement on suspicious logins

---

## Middleware Chain Order

```
1. Rate Limit (existing)
   ↓
2. Auth-Specific Rate Limit (new)
   ↓
3. CSRF Validation (new) [POST/PUT/DELETE only]
   ↓
4. JWT Validation (new) [protected routes only]
   ↓
5. Session Context (new) [load session data]
   ↓
6. Request Context (new) [setup logging/tracing]
   ↓
→ API Route Handler
```

---

## Environment Variables

```bash
# Token generation
JWT_SECRET=base64-256-bit-key
JWT_ALGORITHM=HS256
JWT_ISSUER=psychology-coach
JWT_ACCESS_TOKEN_EXPIRY=900
JWT_REFRESH_TOKEN_EXPIRY=604800

# CSRF
CSRF_TOKEN_LENGTH=32
CSRF_TOKEN_EXPIRY=86400

# Sessions
MAX_ACTIVE_SESSIONS_PER_USER=5
SESSION_TIMEOUT_MINUTES=1440

# Rate limiting
AUTH_LOGIN_RATE_LIMIT=5
AUTH_REFRESH_RATE_LIMIT=30
AUTH_VERIFY_RATE_LIMIT=3

# Geolocation
GEOLOCATION_API=maxmind
MAXMIND_ACCOUNT_ID=...
MAXMIND_LICENSE_KEY=...

# Anomaly detection
IMPOSSIBLE_TRAVEL_SPEED_THRESHOLD=900
RAPID_DEVICE_SWITCH_THRESHOLD=3
```

---

## Code Examples

### Login Flow (Server)
```typescript
// Validate credentials
const user = await prisma.user.findUnique({ where: { email } });
if (!user || !verifyPassword(password, user.passwordHash)) {
  throw new UnauthorizedError("Invalid credentials");
}

// Create session with anomaly detection
const fingerprint = generateDeviceFingerprint(req);
const location = await getLocationFromIP(getClientIP(req));
const anomalies = await detectAnomalies(user.id, { fingerprint, location });

const authSession = await prisma.authSession.create({
  data: {
    userId: user.id,
    deviceName: fingerprint.name,
    country: location.country,
    city: location.city,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    mfaRequired: anomalies.some(a => a.severity === "critical"),
  },
});

// Generate tokens
const accessToken = tokenManager.generateAccessToken({
  userId: user.id,
  sessionId: authSession.id,
});

const refreshToken = await refreshTokenManager.createRefreshToken({
  authSessionId: authSession.id,
});

// Return response
const response = NextResponse.json({
  accessToken,
  csrfToken: csrfProtection.generateToken(),
  user: { id: user.id, email: user.email },
  requiresMfa: authSession.mfaRequired,
});

response.cookies.set("refreshToken", refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60,
});

return response;
```

### Protected Route (Server)
```typescript
export const POST = withErrorHandler(async (req: NextRequest) => {
  // Middleware already injected:
  const userId = (req as any).userId;
  const sessionId = (req as any).sessionId;
  const authSession = (req as any).authSession;

  if (!userId) {
    throw new UnauthorizedError("Missing authentication");
  }

  // Your business logic here
  // ...
});
```

### Token Refresh (Server)
```typescript
const refreshToken = req.cookies.get("refreshToken")?.value;
if (!refreshToken) {
  throw new InvalidTokenError("No refresh token");
}

// Validate and rotate
const tokenRecord = await refreshTokenManager.validateRefreshToken(refreshToken);
if (!tokenRecord) {
  throw new InvalidTokenError("Invalid refresh token");
}

const newRefreshToken = await refreshTokenManager.rotateRefreshToken(
  tokenRecord.id
);

const newAccessToken = tokenManager.generateAccessToken({
  userId: tokenRecord.authSession.userId,
  sessionId: tokenRecord.authSession.id,
});

const response = NextResponse.json({ accessToken: newAccessToken });
response.cookies.set("refreshToken", newRefreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60,
});

return response;
```

### Client-Side (React)
```typescript
// useAuth hook
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [user, setUser] = useState(null);

const login = async (email: string, password: string) => {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (response.ok) {
    const data = await response.json();
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("csrfToken", data.csrfToken);
    setUser(data.user);
    setIsAuthenticated(true);
  }
};

const makeRequest = async (url: string, options = {}) => {
  const accessToken = localStorage.getItem("accessToken");
  const csrfToken = localStorage.getItem("csrfToken");

  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": `Bearer ${accessToken}`,
      "X-CSRF-Token": csrfToken,
    },
    credentials: "include",
  });

  if (response.status === 401) {
    // Token expired, refresh
    const refreshResponse = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });

    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      localStorage.setItem("accessToken", data.accessToken);

      // Retry original request
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          "Authorization": `Bearer ${data.accessToken}`,
          "X-CSRF-Token": csrfToken,
        },
        credentials: "include",
      });
    } else {
      // Refresh failed, redirect to login
      window.location.href = "/login";
    }
  }

  return response;
};
```

---

## Testing Checklist

### Unit Tests
- [ ] JWT generation & validation
- [ ] Refresh token rotation
- [ ] CSRF token handling
- [ ] Device fingerprinting
- [ ] Anomaly detection

### Integration Tests
- [ ] Login flow
- [ ] Token refresh flow
- [ ] Logout flow
- [ ] CSRF protection
- [ ] Multi-device sessions

### Security Tests
- [ ] JWT tampering detected
- [ ] Token replay prevented
- [ ] CSRF bypass blocked
- [ ] Session fixation prevented
- [ ] Brute force limited

### Manual Tests
- [ ] Login from new device
- [ ] Impossible travel scenario
- [ ] Rapid device switching
- [ ] List and revoke sessions
- [ ] Token refresh works
- [ ] Logout clears cookies

---

## Deployment Checklist

- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Sentry alerting set up
- [ ] Rate limits tuned
- [ ] Geolocation service tested
- [ ] HTTPS enforced
- [ ] Error handling verified
- [ ] Logging working
- [ ] Performance baseline established
- [ ] Security review completed
- [ ] Team trained
- [ ] Runbook updated
- [ ] Monitoring dashboard created
- [ ] Rollback plan tested

---

## Troubleshooting

### "Invalid CSRF token"
- Ensure X-CSRF-Token header sent on POST/PUT/DELETE
- Check CSRF token not expired (1 day)
- Verify credentials: include in fetch

### "Token expired"
- Implement automatic token refresh on 401
- Check JWT_ACCESS_TOKEN_EXPIRY setting (should be 900s)

### "No refresh token"
- Verify cookies sent with credentials: include
- Check refreshToken cookie exists
- Verify HttpOnly flag not breaking

### "Session revoked"
- User logged out or timed out (7 days)
- User logged out from another device (logout-all)
- Admin revoked session
- Security incident triggered revocation

### Impossible Travel Alert
- Geolocation API misconfigured
- Check GEOLOCATION_API and API keys
- Verify IP addresses not hardcoded
- Check speed threshold: 900 km/h default

---

## Performance Targets

| Operation | Target | Actual |
|-----------|--------|--------|
| Token validation | < 5ms | _____ |
| Session lookup | < 10ms | _____ |
| Anomaly detection | < 50ms | _____ |
| Geolocation lookup | < 100ms | _____ |
| Full login flow | < 500ms | _____ |
| Token refresh | < 200ms | _____ |

---

## Resources

### Documentation Files
- `PHASE7_SESSION_MANAGEMENT.md` - Full implementation guide (500+ lines)
- `PHASE7_API_REFERENCE.md` - Complete API reference
- `PHASE7_ARCHITECTURE.md` - Technical architecture & diagrams
- `PHASE7_IMPLEMENTATION_SUMMARY.md` - Project overview
- `PHASE7_QUICK_REFERENCE.md` - This file

### Key URLs
- JWT.io - https://jwt.io/
- OWASP CSRF - https://owasp.org/www-community/attacks/csrf
- Sentry Docs - https://docs.sentry.io/
- Next.js Security - https://nextjs.org/docs/going-to-production

### Code Location
- Token generation: `src/lib/security/tokenManager.ts`
- Middleware: `src/lib/middleware/*.ts`
- API routes: `src/app/api/auth/*.ts`
- Database models: `prisma/schema.prisma`

---

## Next Phase (Phase 8)

**Multi-Factor Authentication**

- TOTP (Time-based One-Time Password)
- Email OTP
- Backup codes
- Device trust settings

---

**Last Updated**: 2026-06-15  
**Status**: Ready for Implementation  
**Version**: 1.0
