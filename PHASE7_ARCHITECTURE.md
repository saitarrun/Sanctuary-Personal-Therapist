# Phase 7 Architecture & Data Flow

Detailed architecture diagrams and technical specifications.

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT APPLICATION                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ React Components (Login, SessionManager, ProtectedRoutes)              │ │
│  │  • useAuth() hook                                                       │ │
│  │  • authClient singleton                                                │ │
│  │  • Token refresh on 401                                                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ HTTP Client (fetch/axios)                                               │ │
│  │  • Headers: Authorization, X-CSRF-Token, X-Request-ID                  │ │
│  │  • Credentials: include (for httpOnly cookies)                         │ │
│  │  • Automatic retry on 401 with token refresh                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌─────────────────────────┐    ┌─────────────────────────┐
        │   HTTP Headers          │    │   HttpOnly Cookies      │
        │ ───────────────────     │    │ ─────────────────────   │
        │ Authorization: Bearer   │    │ refreshToken=<hash>     │
        │ X-CSRF-Token: <token>   │    │ csrfToken=<token>       │
        │ X-Request-ID: <uuid>    │    │ Secure; SameSite=Strict │
        └─────────────────────────┘    └─────────────────────────┘
                    │                               │
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS MIDDLEWARE CHAIN                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 1. Rate Limit Middleware                                               │ │
│  │    • IP-based rate limiting (from existing phase 3)                    │ │
│  │    • Auth-specific rate limits (new)                                   │ │
│  │    • Progressive backoff on auth failures                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 2. CSRF Middleware (if POST/PUT/DELETE)                                │ │
│  │    • Extract CSRF token from header or cookie                          │ │
│  │    • Validate against stored token                                     │ │
│  │    • Reject if missing/mismatched (403)                                │ │
│  │    • Skip for /api/auth/login, /api/auth/csrf                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 3. JWT Auth Middleware (if protected route)                            │ │
│  │    • Extract JWT from Authorization header                             │ │
│  │    • Verify signature using RS_PUBLIC_KEY or JWT_SECRET                │ │
│  │    • Check exp claim (reject if exp < now)                             │ │
│  │    • Load AuthSession from DB                                          │ │
│  │    • Check !isRevoked flag                                             │ │
│  │    • Inject userId, sessionId into request context                     │ │
│  │    • Skip for /api/auth/* (pre-auth endpoints)                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 4. Session Context Middleware                                          │ │
│  │    • Load AuthSession record by sessionId                              │ │
│  │    • Check mfaRequired flag (reject if true & mfaVerifiedAt missing)   │ │
│  │    • Update lastActivityAt timestamp                                   │ │
│  │    • Attach session metadata to request                                │ │
│  │    • Check for session anomalies                                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 5. Request Context Setup                                               │ │
│  │    • Generate/inject X-Request-ID header                               │ │
│  │    • Set up Sentry context (userId, sessionId)                         │ │
│  │    • Set up logging context                                            │ │
│  │    • Anonymize IP address                                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API ROUTE HANDLERS                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ /api/auth/csrf           - Get CSRF token (public)                     │ │
│  │ /api/auth/login          - Authenticate user                          │ │
│  │ /api/auth/logout         - Revoke session (protected)                  │ │
│  │ /api/auth/refresh        - Rotate tokens                               │ │
│  │ /api/auth/verify         - MFA verification                            │ │
│  │ /api/auth/sessions       - List user sessions (protected)              │ │
│  │ /api/auth/sessions/[id]  - Revoke specific session (protected)         │ │
│  │ /api/chat                - Chat endpoint (protected)                   │ │
│  │ /api/sessions            - Chat session management (protected)         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
        ┌──────────────────┐ ┌─────────────┐ ┌──────────────┐
        │ Security Layer   │ │ Data Layer  │ │Monitoring    │
        └──────────────────┘ └─────────────┘ └──────────────┘
```

---

## 2. Token Management Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                      TOKEN MANAGER (JWT)                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ ACCESS TOKEN (JWT)                                             │ │
│  │ ───────────────────                                            │ │
│  │ Header: { alg: "HS256", typ: "JWT" }                          │ │
│  │                                                                │ │
│  │ Payload:                                                       │ │
│  │ {                                                              │ │
│  │   "sub": "user-id",                    # Subject (user ID)    │ │
│  │   "sid": "auth-session-id",            # Session ID          │ │
│  │   "iat": 1687800000,                   # Issued at           │ │
│  │   "exp": 1687800900,                   # Expires (15 min)    │ │
│  │   "jti": "jwt-id",                     # JWT ID (unique)     │ │
│  │   "ver": 1,                            # JWT version         │ │
│  │   "iss": "psychology-coach",           # Issuer              │ │
│  │   "aud": "api"                         # Audience            │ │
│  │ }                                                              │ │
│  │                                                                │ │
│  │ Signature: HS256(base64url(header) + "." + base64url(payload),│ │
│  │           secret_key)                                         │ │
│  │                                                                │ │
│  │ Properties:                                                    │ │
│  │  • Duration: 15 minutes (short-lived)                        │ │
│  │  • Storage: Memory (never persisted)                          │ │
│  │  • Transmission: Authorization header (Bearer)                │ │
│  │  • Rotation: On every refresh token rotation                  │ │
│  │  • Validation: Signature + expiry + session check             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ REFRESH TOKEN (Opaque)                                         │ │
│  │ ──────────────────────                                         │ │
│  │ Random 256-bit token (not JWT)                                 │ │
│  │ Hashed and stored in database                                  │ │
│  │                                                                │ │
│  │ Table: RefreshToken                                           │ │
│  │ ──────────────────────                                         │ │
│  │ Columns:                                                       │ │
│  │  • id: CUID (primary key)                                     │ │
│  │  • authSessionId: Foreign key → AuthSession                   │ │
│  │  • tokenHash: SHA-256(token) [UNIQUE]                         │ │
│  │  • rotationCount: Int (audit trail)                           │ │
│  │  • isRevoked: Boolean (soft-delete)                           │ │
│  │  • revokedAt: DateTime (timestamp)                            │ │
│  │  • familyId: String (rotation chain)                          │ │
│  │  • expiresAt: DateTime (7 days from creation)                │ │
│  │  • createdAt, updatedAt: Timestamps                           │ │
│  │                                                                │ │
│  │ Properties:                                                    │ │
│  │  • Duration: 7 days                                            │ │
│  │  • Storage: HttpOnly, Secure, SameSite=Strict cookie          │ │
│  │  • Transmission: Via request cookies (automatic)              │ │
│  │  • Rotation: Single-use (revoked after refresh)               │ │
│  │  • Validation: Hash lookup + family ID check                  │ │
│  │  • Replay Detection: Family ID chain prevents token replay    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  TOKEN GENERATION FLOW:                                              │
│  ─────────────────────────                                          │
│                                                                       │
│  1. User logs in                                                     │
│     └─► Generate random 256-bit refresh token                       │
│         Hash token: SHA-256(token)                                  │
│         Generate familyId: Random CUID                              │
│         Store: RefreshToken { hash, familyId, expiresAt }           │
│                                                                       │
│  2. Generate access token (JWT)                                      │
│     └─► Header: { alg: "HS256", typ: "JWT" }                       │
│         Payload: { sub, sid, iat, exp: now+900, ver, ... }          │
│         Sign with JWT_SECRET                                        │
│                                                                       │
│  3. Return to client                                                 │
│     └─► accessToken: Send in response body (store in memory)        │
│         refreshToken: Set in httpOnly cookie                        │
│                                                                       │
│  TOKEN REFRESH FLOW:                                                 │
│  ───────────────────                                                │
│                                                                       │
│  1. Client calls POST /api/auth/refresh                             │
│     └─► Sends httpOnly cookie with refresh token (automatic)        │
│                                                                       │
│  2. Server extracts & validates refresh token                        │
│     └─► Get token from cookie                                       │
│         Hash it: SHA-256(token)                                     │
│         Lookup in DB by tokenHash (unique index)                    │
│         Verify: !isRevoked, !expired, familyId matches              │
│                                                                       │
│  3. Detect replay attacks                                            │
│     └─► If familyId exists but tokens different → BREACH            │
│         Revoke all tokens in family                                 │
│         Log to SessionAnomalyLog                                    │
│         Send Sentry alert                                           │
│                                                                       │
│  4. Rotate refresh token                                             │
│     └─► Mark old token: isRevoked=true, revokedAt=now               │
│         Increment rotationCount                                     │
│         Generate new token with same familyId                       │
│         Store: RefreshToken { hash, familyId, expiresAt }           │
│                                                                       │
│  5. Generate new access token (JWT)                                  │
│     └─► Same payload structure as initial login                     │
│         New exp: now + 900 seconds                                  │
│         Sign with same JWT_SECRET                                   │
│                                                                       │
│  6. Return to client                                                 │
│     └─► accessToken: Return in response body                        │
│         refreshToken: Update httpOnly cookie                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Session Lifecycle Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                    SESSION LIFECYCLE (7 days)                          │
└────────────────────────────────────────────────────────────────────────┘

                           LOGIN
                            │
                            ▼
              ┌─────────────────────────────┐
              │ Detect Anomalies            │
              │ • Device fingerprint        │
              │ • Geolocation check         │
              │ • Impossible travel?        │
              │ • Rapid device switch?      │
              │ • Concurrent session limit? │
              └──────────┬──────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   No Anomalies    Info Anomaly      Critical Anomaly
        │           (log only)         (require MFA)
        │                │                │
        └────────┬───────┴────────┬───────┘
                 │                │
                 ▼                ▼
       ┌──────────────────────────────────┐
       │ Create AuthSession               │
       │ ──────────────────────────────   │
       │ • id: CUID                       │
       │ • userId: FK                     │
       │ • deviceName: "Chrome on macOS"  │
       │ • deviceType: "desktop"          │
       │ • country: "United States"       │
       │ • city: "San Francisco"          │
       │ • ipAddress: "192.168.0.0"       │
       │ • expiresAt: now + 7 days        │
       │ • lastActivityAt: now            │
       │ • isRevoked: false               │
       │ • mfaRequired: critical?         │
       │ • riskScore: 0-100               │
       │ • createdAt, updatedAt           │
       └──────┬───────────────────────────┘
              │
              ▼
       ┌──────────────────────┐
       │ Generate Tokens      │
       ├──────────────────────┤
       │ • JWT (15 min exp)   │
       │ • Refresh (7d exp)   │
       │ • CSRF (1d exp)      │
       └──────┬───────────────┘
              │
              ▼
       ┌──────────────────────┐
       │ Return to Client     │
       ├──────────────────────┤
       │ • accessToken        │
       │ • csrfToken          │
       │ • refreshToken       │
       │   (httpOnly cookie)  │
       └──────────────────────┘
              │
              │
              │ ┌─── ACTIVE SESSION (7 days) ───┐
              │ │                                 │
              │ ▼                                 │
              │ ┌─────────────────────────────┐  │
              │ │ Client Makes Requests       │  │
              │ │ ─────────────────────────   │  │
              │ │ • Send JWT in header        │  │
              │ │ • Send CSRF token           │  │
              │ │ • Server validates both     │  │
              │ │ • Update lastActivityAt     │  │
              │ └──────────┬──────────────────┘  │
              │            │                     │
              │            ▼                     │
              │ ┌─────────────────────────────┐  │
              │ │ 15-Min JWT Expiry?          │  │
              │ └──────────┬──────────────────┘  │
              │            │                     │
              │      ┌─────┴──────┐              │
              │      │            │              │
              │      ▼ (Yes)      ▼ (No)         │
              │  ┌────────┐   ┌────────┐         │
              │  │ Refresh│   │Continue│         │
              │  │ Token  │   │Request │         │
              │  └────────┘   └────────┘         │
              │      │            │              │
              │      └─────┬──────┘              │
              │            │ (repeat)           │
              │            │                    │
              │ ┌──────────┴──────────┐          │
              │ │ 7-Day Absolute      │          │
              │ │ Expiry?             │          │
              │ └──────────┬──────────┘          │
              │            │                    │
              │            ▼ (Yes)              │
              │ ┌─────────────────────┐         │
              │ │ Force Re-login      │         │
              │ │ (Expire all tokens) │         │
              │ └─────────────────────┘         │
              │                                 │
              └─────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Session Ends         │
              │ • Expired/Revoked    │
              │ • User Logout        │
              │ • Admin Revocation   │
              │ • Security Incident  │
              └──────┬───────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │ Revoke Session            │
         │ ──────────────────────    │
         │ • Set isRevoked=true      │
         │ • Revoke all refresh      │
         │   tokens in this session  │
         │ • Clear cookies           │
         │ • Log AuditLog entry      │
         │ • Sentry event            │
         └───────────────────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │ User Must Re-Login        │
         └───────────────────────────┘
```

---

## 4. Data Model Relationships

```
┌────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                                │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│      User           │ (Existing)
├─────────────────────┤
│ id (PK)             │
│ email (UNIQUE)      │
│ passwordHash        │
│ firstName           │
│ lastName            │
│ phone (encrypted)   │
│ preferences (JSON)  │
│ createdAt           │
│ updatedAt           │
│ deletedAt (soft)    │
└──────────┬──────────┘
           │
           │ 1:N
           │
           ▼
┌─────────────────────────────────────────┐
│      AuthSession (Modified in Phase 7)  │ (NEW relationships)
├─────────────────────────────────────────┤
│ id (PK)                                 │
│ userId (FK → User)                      │
│ deviceName: "Chrome on macOS"           │
│ deviceType: "desktop"                   │
│ country: "US"                           │
│ city: "San Francisco"                   │
│ ipAddress (anonymized)                  │
│ lastActivityAt                          │
│ expiresAt                               │
│ isRevoked: boolean                      │
│ ──────────────────────────────          │
│ refreshTokenFamily: string (NEW)        │ Track token family
│ jwtVersion: int = 1 (NEW)               │ For key rotation
│ riskScore: int 0-100 (NEW)              │ Anomaly scoring
│ mfaRequired: boolean (NEW)              │ Phase 8: MFA flag
│ mfaVerifiedAt: datetime (NEW)           │ Phase 8: MFA check
│ ──────────────────────────────          │
│ createdAt, updatedAt                    │
└─────┬──────────────────────────┬────────┘
      │ 1:N                      │ 1:N
      │                          │
      ▼                          ▼
┌───────────────────┐    ┌──────────────────────┐
│  RefreshToken     │    │ SessionAnomalyLog    │
│  (NEW in Phase 7) │    │ (NEW in Phase 7)     │
├───────────────────┤    ├──────────────────────┤
│ id (PK)           │    │ id (PK)              │
│ authSessionId (FK)│    │ authSessionId (FK)   │
│ tokenHash(UNIQUE) │    │ userId (FK)          │
│ rotationCount     │    │ anomalyType          │
│ isRevoked         │    │ severity             │
│ revokedAt         │    │ previousLocation     │
│ familyId (INDEX)  │    │ currentLocation      │
│ expiresAt (INDEX) │    │ previousIpHash       │
│ createdAt         │    │ currentIpHash        │
│ updatedAt         │    │ previousDeviceName   │
└───────────────────┘    │ currentDeviceName    │
                         │ actionTaken          │
                         │ metadata (JSON)      │
                         │ detectedAt (INDEX)   │
                         └──────────────────────┘


┌──────────────────────┐
│  Session (Existing)  │ Updated to link to User
├──────────────────────┤
│ id (PK)              │
│ title                │
│ userId (FK) (NEW)    │ Link to User for auth
│ createdAt            │
│ updatedAt            │
└─────┬────────────────┘
      │ 1:N
      │
      ▼
┌──────────────────────┐
│  Message             │ (Unchanged)
├──────────────────────┤
│ id (PK)              │
│ sessionId (FK)       │
│ role                 │
│ content              │
│ crisisFlag           │
│ provider             │
│ createdAt            │
└──────────────────────┘


┌──────────────────────────────┐
│  AuditLog (Existing)         │ Used by Phase 7
├──────────────────────────────┤
│ id (PK)                      │
│ userId (FK)                  │
│ action: LOGIN, LOGOUT,       │
│         TOKEN_REFRESH,       │
│         MFA_VERIFY, etc.     │
│ resourceType: "auth"         │
│ oldValue, newValue           │
│ performedBy                  │
│ ipAddress (anonymized)       │
│ userAgent                    │
│ status: SUCCESS/FAILURE      │
│ createdAt (immutable)        │
└──────────────────────────────┘
```

---

## 5. Security State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                  SESSION SECURITY STATES                        │
└─────────────────────────────────────────────────────────────────┘

                      ┌──────────────┐
                      │   UNAUTHENTICATED   │
                      │   (No Session)      │
                      └────────┬─────────────┘
                               │
                               │ POST /api/auth/login
                               │ Valid credentials
                               │
                               ▼
                      ┌──────────────────────┐
                      │   AUTHENTICATED      │
                      │   (JWT + Cookies)    │
                      └────────┬─────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
         ┌──────────▼────────────┐ ┌─────▼──────────────────┐
         │   NORMAL SESSION      │ │   ANOMALY DETECTED     │
         │   ────────────────    │ │   ──────────────────   │
         │ • Low risk score      │ │ • Risk score: 50-100   │
         │ • MFA not required    │ │ • MFA required         │
         │ • All requests OK     │ │ • Requests blocked     │
         └──────────┬────────────┘ │   until MFA verified   │
                    │              └──────┬──────────────────┘
                    │                     │
                    │                POST /api/auth/verify
                    │                Valid MFA code
                    │                     │
                    │                     ▼
                    │            ┌──────────────────┐
                    │            │   VERIFIED       │
                    │            │   (Anomaly OK)   │
                    │            └────────┬─────────┘
                    │                     │
                    └──────────┬──────────┘
                               │
                   All requests OK (normal operation)
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
           ┌─────▼────────┐          ┌──────▼────────────┐
           │   JWT EXPIRES        │   REFRESH TOKEN      │
           │   (15 minutes)       │   EXPIRES (7 days)   │
           └─────┬────────┘       └──────┬────────────────┘
                 │                       │
           ┌─────▼────────────────────────┘
           │
           │ POST /api/auth/refresh
           │ Valid refresh token
           │
           ▼
      ┌─────────────┐
      │  Token      │ (Back to AUTHENTICATED)
      │  Rotated    │
      └─────────────┘
           │
           │
           └───► (Return to AUTHENTICATED state)


    FORCED TRANSITIONS (Security Events):

┌────────────────────────────────────┐
│    ACTIVE SESSION                  │
│    (Any state above)               │
├────────────────────────────────────┤
│ Trigger Events:                    │
│ • POST /api/auth/logout            │
│ • Token family breach detected     │
│ • Account compromised              │
│ • Admin revocation                 │
│ • 30-day absolute timeout          │
│ • IP geolocation mismatch (breach) │
│ • >3 failed MFA attempts           │
└────────────────┬─────────────────────┘
                 │
                 │ Force revocation
                 ▼
        ┌──────────────────┐
        │   REVOKED        │
        │   (Session Dead) │
        └──────────────────┘
                 │
                 │ Cannot make requests
                 │ Cannot use tokens
                 │
                 ▼
        ┌──────────────────┐
        │   MUST RE-LOGIN  │
        │   (403/401)      │
        └──────────────────┘
```

---

## 6. Request Authorization Flow (Decision Tree)

```
┌──────────────────────────────────────────────────────────────────┐
│              REQUEST AUTHORIZATION FLOW                          │
└──────────────────────────────────────────────────────────────────┘

                    Incoming Request
                           │
                           ▼
              ┌──────────────────────────┐
              │ Is this /api/auth/* ?    │
              └──────────┬─────────────┬─┘
                         │             │
                    Yes  │             │ No
                         ▼             ▼
                  ┌────────────┐   ┌─────────────────────────┐
                  │ Public or  │   │ Requires Authentication │
                  │ Pre-Auth   │   └───────────┬─────────────┘
                  └────────────┘               │
                       │                       ▼
                       │           ┌──────────────────────────┐
                       │           │ Extract Authorization    │
                       │           │ Header: "Bearer <jwt>"   │
                       │           └──────────┬───────────────┘
                       │                      │
                       │                      ▼
                       │           ┌──────────────────────────┐
                       │           │ Parse JWT               │
                       │           │ • Split on "."          │
                       │           │ • Decode header/payload │
                       │           │ • Extract exp & sid     │
                       │           └──────────┬───────────────┘
                       │                      │
                       │                      ▼
                       │           ┌──────────────────────────┐
                       │           │ Verify JWT Signature     │
                       │           │ • HMAC(secret, msg) ==   │
                       │           │   signature?             │
                       │           └──────────┬───────────────┘
                       │                      │
                       │              ┌───────┴────────┐
                       │              │                │
                       │          ✓ Valid         ✗ Invalid
                       │              │                │
                       │              │                ▼
                       │              │        ┌──────────────┐
                       │              │        │  401 Unauth  │
                       │              │        │  (Bad sig)   │
                       │              │        └──────────────┘
                       │              │
                       │              ▼
                       │    ┌──────────────────────────┐
                       │    │ Check Token Expiry       │
                       │    │ • exp < now?             │
                       │    └──────────┬───────────────┘
                       │               │
                       │       ┌───────┴──────┐
                       │       │              │
                       │   ✗ Expired     ✓ Valid
                       │       │              │
                       │       ▼              │
                       │   ┌──────────────┐   │
                       │   │  401 Token   │   │
                       │   │  Expired     │   │
                       │   └──────────────┘   │
                       │                      │
                       │                      ▼
                       │         ┌──────────────────────────┐
                       │         │ Load AuthSession         │
                       │         │ • Query by sessionId     │
                       │         │ • from JWT.sid           │
                       │         └──────────┬───────────────┘
                       │                    │
                       │                    ▼
                       │         ┌──────────────────────────┐
                       │         │ Check Session State      │
                       │         │ • isRevoked == false?    │
                       │         │ • expiresAt > now?       │
                       │         │ • userId == JWT.sub?     │
                       │         └──────────┬───────────────┘
                       │                    │
                       │            ┌───────┴────────┐
                       │            │                │
                       │        ✓ Valid         ✗ Invalid
                       │            │                │
                       │            │                ▼
                       │            │       ┌──────────────┐
                       │            │       │  401 Session │
                       │            │       │  Invalid/    │
                       │            │       │  Revoked     │
                       │            │       └──────────────┘
                       │            │
                       │            ▼
                       │  ┌──────────────────────────┐
                       │  │ Check MFA Requirement    │
                       │  │ • mfaRequired == true?   │
                       │  │ • mfaVerifiedAt exists?  │
                       │  └──────────┬───────────────┘
                       │             │
                       │     ┌───────┴──────────┐
                       │     │                  │
                       │ MFA Req'd &       MFA OK
                       │ No Verify         or not req'd
                       │     │                  │
                       │     ▼                  │
                       │ ┌──────────────┐       │
                       │ │  403 MFA     │       │
                       │ │  Required    │       │
                       │ └──────────────┘       │
                       │                        │
                       │                        ▼
                       │            ┌──────────────────────┐
                       │            │ Validate CSRF Token  │
                       │            │ (if POST/PUT/DELETE) │
                       │            └──────────┬───────────┘
                       │                       │
                       │               ┌───────┴───────┐
                       │               │               │
                       │           ✓ Valid        ✗ Invalid
                       │               │               │
                       │               │               ▼
                       │               │       ┌──────────────┐
                       │               │       │  403 CSRF    │
                       │               │       │  Token Bad   │
                       │               │       └──────────────┘
                       │               │
                       │               ▼
                       │    ┌────────────────────────┐
                       │    │ ✓ AUTHORIZED          │
                       │    │ • Update lastActivity │
                       │    │ • Inject userId       │
                       │    │ • Attach session      │
                       │    │ • Proceed to handler  │
                       │    └────────────────────────┘
                       │               │
                       └───────┬───────┘
                               │
                               ▼
                        Proceed to Handler
                        (API business logic)
```

---

## 7. Anomaly Detection Decision Logic

```
┌──────────────────────────────────────────────────────────────┐
│            ANOMALY DETECTION ALGORITHM                       │
└──────────────────────────────────────────────────────────────┘

                        Login Request
                             │
                             ▼
                    ┌─────────────────┐
                    │ Check History   │
                    │ Last session?   │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                ✓ Exists         ✗ None (First)
                    │                 │
                    ▼                 ▼
         ┌──────────────────┐ ┌─────────────────┐
         │ Analyze Previous │ │ Flag: First     │
         │ Session          │ │ Login           │
         └────────┬─────────┘ │ Severity: info  │
                  │           └─────────────────┘
                  │
                  ▼
         ┌──────────────────────────────┐
         │ 1. DEVICE FINGERPRINT CHECK  │
         │ ────────────────────────────│ │
         │ Same device as last session? │
         └────────┬─────────────────────┘
                  │
          ┌───────┴────────┐
          │                │
      ✓ Same          ✗ Different
          │                │
          │                ▼
          │    ┌──────────────────────┐
          │    │ Count device changes │
          │    │ in last 15 mins      │
          │    └──────────┬───────────┘
          │               │
          │           ┌───┴───┐
          │           │       │
          │    >3 devices ✓ ≤3
          │           │       │
          │           ▼       │
          │    Flag: rapid_   │
          │    device_change  │
          │    Severity:      │
          │    warning        │
          │           │       │
          └────────┬──┴───────┘
                   │
                   ▼
         ┌──────────────────────────────┐
         │ 2. GEOLOCATION CHECK         │
         │ ────────────────────────────│ │
         │ Has previous location?       │
         └────────┬─────────────────────┘
                  │
          ┌───────┴───────┐
          │               │
      ✓ Yes           ✗ No
          │               │
          ▼               │
   ┌────────────────────┐ │
   │ Calculate distance │ │
   │ & time elapsed     │ │
   │                    │ │
   │ distance = km      │ │
   │ time = minutes     │ │
   │ speed = distance/  │ │
   │        (time/60)   │ │
   └────────┬───────────┘ │
            │             │
            ▼             │
   ┌───────────────────────────────┐
   │ Is speed > 900 km/h?          │
   │ (Impossible commercial travel)│
   └────────┬────────────────┬─────┘
            │                │
        ✓ YES           ✗ NO
            │                │
            ▼                │
   ┌─────────────────┐       │
   │ Flag: impossible│       │
   │_travel          │       │
   │ Severity:       │       │
   │ CRITICAL        │       │
   │ Action: Require │       │
   │ MFA verification│       │
   │ Lock session    │       │
   └─────────────────┘       │
            │                │
            └────────┬───────┘
                     │
                     ▼
         ┌──────────────────────────────┐
         │ 3. CONCURRENT SESSION LIMIT  │
         │ ────────────────────────────│ │
         │ Count active sessions        │
         │ for this user                │
         └────────┬─────────────────────┘
                  │
          ┌───────┴────────┐
          │                │
      ≥5 sessions      <5 sessions
          │                │
          ▼                │
   ┌─────────────────┐     │
   │ Flag: concurrent│     │
   │_limit           │     │
   │ Severity: info  │     │
   │ Action: Remove  │     │
   │ oldest session  │     │
   └─────────────────┘     │
            │              │
            └────────┬─────┘
                     │
                     ▼
         ┌──────────────────────────────┐
         │ 4. SAME-LOCATION CONSISTENCY │
         │ ────────────────────────────│ │
         │ Same city as previous?       │
         └────────┬─────────────────────┘
                  │
          ┌───────┴───────────────┐
          │                       │
      ✓ Same              ✗ Different
          │                       │
          │                       ▼
          │           ┌──────────────────────┐
          │           │ Flag: new_location   │
          │           │ Severity: info       │
          │           │ Action: Log & monitor│
          │           └──────────────────────┘
          │                       │
          └───────────┬───────────┘
                      │
                      ▼
         ┌──────────────────────────────┐
         │ COMPILE ANOMALY RESULTS      │
         │ ────────────────────────────│ │
         │ • List of anomalies found    │
         │ • Severity levels            │
         │ • Required actions           │
         │ • Risk score calculation     │
         └────────┬─────────────────────┘
                  │
                  ▼
         ┌──────────────────────────────┐
         │ DETERMINE ACTION             │
         │ ────────────────────────────│ │
         │ If critical anomaly exists:  │
         │   → mfaRequired = true       │
         │   → Return requiresMfa flag  │
         │                              │
         │ If warning anomalies:        │
         │   → Log all anomalies        │
         │   → Send to Sentry           │
         │   → Increase risk score      │
         │                              │
         │ Otherwise:                   │
         │   → Normal login             │
         └──────────────────────────────┘
```

---

## 8. Integration Points with Existing Systems

```
┌─────────────────────────────────────────────────────────────────┐
│        PHASE 7 INTEGRATION WITH EXISTING PHASES                 │
└─────────────────────────────────────────────────────────────────┘

PHASE 2: Monitoring & Logging (Sentry)
─────────────────────────────────────
    logger.ts (existing)
         ↓
    Phase 7: authMonitoring.ts (new)
         ↓
    Sentry Breadcrumbs:
    • auth.login.success
    • auth.login.failure
    • auth.refresh.success
    • auth.security_anomaly
         ↓
    Sentry Events:
    • Event type: "auth"
    • Tags: { event_type, userId, sessionId }
    • Fingerprint: [ "auth", event_type ]


PHASE 3: Rate Limiting
──────────────────────
    limiter.ts (existing)
         ↓
    Phase 7: rateLimitAuth.ts (new)
         ↓
    New Limits:
    • /api/auth/login: 5 per IP per minute
    • /api/auth/refresh: 30 per session per minute
    • /api/auth/verify: 3 per session per minute
    • Progressive backoff on failures


PHASE 4: Performance Optimization
──────────────────────────────────
    performance.ts (existing)
         ↓
    Phase 7 uses:
    • PerformanceTimer for token operations
    • Track JWT validation time
    • Track geolocation lookup time
    • Track DB queries for sessions


PHASE 6: User Profiles & Privacy (HIPAA)
────────────────────────────────────────
    User model (existing)
         ↓
    Phase 7:
    • AuthSession: 1:N relationship with User
    • RefreshToken: Session → RefreshToken
    • SessionAnomalyLog: Audit trail for privacy
    • AuditLog: Extended for auth events
    • Encryption: IP addresses anonymized
    • Consent: No PII in logs


EXISTING ERROR HANDLING
──────────────────────
    errorHandler.ts
         ↓
    Phase 7 extends:
    • UnauthorizedError (401)
    • TokenExpiredError (401)
    • InvalidTokenError (401)
    • CsrfError (403)
         ↓
    withErrorHandler wrapper
         ↓
    Automatic logging & Sentry reporting


EXISTING MIDDLEWARE
───────────────────
    middleware.ts (rate limiting only)
         ↓
    Phase 7 extends:
    • authMiddleware (JWT validation)
    • csrfMiddleware (token validation)
    • sessionMiddleware (context loading)
    • rateLimitAuth (new rate limits)
         ↓
    Middleware chain order:
    1. Rate limiting (existing)
    2. Auth-specific rate limiting (new)
    3. CSRF validation (new)
    4. JWT validation (new)
    5. Session context (new)
    6. Request context setup (new)


EXISTING API ROUTES
───────────────────
    /api/chat (existing)
         ↓
    Phase 7 changes:
    • Require JWT auth (authMiddleware)
    • Extract userId from token
    • Link to User (not just sessionId)
    • Log with auth context

    /api/sessions (existing)
         ↓
    Phase 7 changes:
    • Filter by authenticated userId
    • Link to User model
    • Return only user's sessions

    /api/auth/* (new routes)
         ├── /login (POST)
         ├── /logout (POST)
         ├── /refresh (POST)
         ├── /verify (POST) [Phase 8: MFA]
         ├── /csrf (GET/POST)
         ├── /sessions (GET)
         └── /sessions/[id] (DELETE)
```

---

## 9. Database Query Patterns

### Common Queries

```typescript
// 1. Validate JWT and load session
const session = await prisma.authSession.findUnique({
  where: { id: jwtPayload.sid },
  include: {
    user: { select: { id: true, email: true } },
  },
});
if (!session || session.isRevoked) throw new UnauthorizedError();

// 2. Check refresh token validity
const tokenRecord = await prisma.refreshToken.findUnique({
  where: { tokenHash: sha256(refreshToken) },
  include: { authSession: true },
});
if (!tokenRecord || tokenRecord.isRevoked) throw new InvalidTokenError();

// 3. Create anomaly log
await prisma.sessionAnomalyLog.create({
  data: {
    authSessionId: session.id,
    userId: session.userId,
    anomalyType: "impossible_travel",
    severity: "critical",
    currentLocation: `${city}, ${country}`,
    metadata: { speed: 950, distance: 900 },
  },
});

// 4. List user sessions
const sessions = await prisma.authSession.findMany({
  where: { userId, isRevoked: false },
  orderBy: { lastActivityAt: 'desc' },
  select: {
    id: true,
    deviceName: true,
    country: true,
    city: true,
    lastActivityAt: true,
    expiresAt: true,
  },
});

// 5. Revoke all user sessions (account compromise)
await prisma.authSession.updateMany({
  where: { userId },
  data: { isRevoked: true },
});
await prisma.refreshToken.updateMany({
  where: { authSession: { userId } },
  data: { isRevoked: true, revokedAt: new Date() },
});
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-06-15  
**Status**: Ready for Implementation
