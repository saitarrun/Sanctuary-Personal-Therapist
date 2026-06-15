# Phase 7 API Reference

## Authentication Endpoints

### POST /api/auth/login
Authenticate user and create session.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "deviceName": "Chrome on Windows",
    "deviceType": "desktop"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "session": {
    "id": "session-456",
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessTokenExpiresAt": "2026-06-15T15:30:00Z"
  }
}
```

**Cookies Set:**
- `refreshToken`: httpOnly, Secure, SameSite=Strict
- `csrfToken`: Regular cookie

**Error (401 Unauthorized):**
```json
{
  "error": "Invalid email or password"
}
```

---

### POST /api/auth/refresh
Refresh access token using refresh token cookie.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Cookie: refreshToken=..." \
  -H "Content-Type: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "accessTokenExpiresAt": "2026-06-15T15:45:00Z"
}
```

**Cookies Set:**
- `refreshToken`: New token (old one blacklisted)
- `csrfToken`: New token

**Error (401 Unauthorized):**
```json
{
  "error": "Invalid or expired refresh token"
}
```

---

### POST /api/auth/logout
Logout and revoke current session.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer <accessToken>" \
  -H "Cookie: refreshToken=..." \
  -H "Content-Type: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Cookies Cleared:**
- `refreshToken`
- `csrfToken`

---

### POST /api/auth/logout-all
Logout from all devices (revoke all sessions).

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/logout-all \
  -H "Authorization: Bearer <accessToken>" \
  -H "X-CSRF-Token: <csrfToken>" \
  -H "Content-Type: application/json"
```

**Response (200 OK):**
```json
{
  "success": true,
  "sessionsRevoked": 3,
  "message": "Logged out from all devices"
}
```

**Cookies Cleared:**
- All refresh tokens invalidated
- All CSRF tokens invalidated

---

## Session Management Endpoints

### GET /api/sessions
List all active sessions for current user.

**Request:**
```bash
curl -X GET http://localhost:3000/api/sessions \
  -H "Authorization: Bearer <accessToken>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "session-123",
      "deviceName": "Chrome on Windows",
      "deviceType": "desktop",
      "ipAddress": "192.168.1.xxx",
      "country": "US",
      "city": "San Francisco",
      "lastActivityAt": "2026-06-15T10:30:00Z",
      "expiresAt": "2026-06-22T10:30:00Z",
      "createdAt": "2026-06-15T10:30:00Z"
    },
    {
      "id": "session-456",
      "deviceName": "Safari on iOS",
      "deviceType": "mobile",
      "ipAddress": "192.168.2.xxx",
      "country": "US",
      "city": "San Francisco",
      "lastActivityAt": "2026-06-15T14:20:00Z",
      "expiresAt": "2026-06-22T14:20:00Z",
      "createdAt": "2026-06-14T14:20:00Z"
    }
  ]
}
```

**Query Parameters:**
- `limit` (optional): Max sessions to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Error (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

---

### DELETE /api/sessions/:sessionId
Logout from one specific device.

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/sessions/session-456 \
  -H "Authorization: Bearer <accessToken>" \
  -H "X-CSRF-Token: <csrfToken>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Session revoked",
  "sessionId": "session-456"
}
```

**Error (404 Not Found):**
```json
{
  "error": "Session not found"
}
```

**Error (403 Forbidden):**
```json
{
  "error": "Cannot revoke current session via this endpoint. Use POST /api/auth/logout"
}
```

---

## Protected Endpoint Usage

All endpoints that modify data (POST, PUT, DELETE) require CSRF protection.

### Example: Make an authenticated request

```bash
# 1. Login to get access token and cookies
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }' \
  -c cookies.txt

# Save access token from response
export ACCESS_TOKEN="<token from response>"

# 2. Make authenticated request
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-CSRF-Token: $(grep csrfToken cookies.txt | cut -f7)" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "message": "Hello!"
  }'
```

### JavaScript Example

```javascript
// Login
const loginResponse = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    password: "password123"
  }),
  credentials: "include" // Include cookies
});

const { session } = await loginResponse.json();
const accessToken = session.accessToken;

// Make authenticated request
const response = await fetch("/api/chat", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${accessToken}`,
    "X-CSRF-Token": getCookie("csrfToken"),
    "Content-Type": "application/json"
  },
  credentials: "include",
  body: JSON.stringify({ message: "Hello!" })
});

if (response.status === 401) {
  // Access token expired, refresh it
  const refreshResponse = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include"
  });
  
  const { accessToken: newAccessToken } = await refreshResponse.json();
  
  // Retry request with new token
  // ...
}
```

---

## Error Responses

### 400 Bad Request
Invalid request format or missing required fields.

```json
{
  "error": "Invalid request body",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["email"],
      "message": "Required"
    }
  ]
}
```

### 401 Unauthorized
Missing or invalid authentication credentials.

```json
{
  "error": "Unauthorized",
  "message": "Access token is missing or invalid"
}
```

### 403 Forbidden
CSRF validation failed or insufficient permissions.

```json
{
  "error": "CSRF validation failed",
  "message": "Token mismatch"
}
```

### 429 Too Many Requests
Rate limit exceeded (Phase 3 rate limiting).

```json
{
  "error": "Too many requests. Please slow down and try again later.",
  "retryAfter": 60
}
```

### 500 Internal Server Error
Server error during processing.

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## Request/Response Headers

### Required Headers for Authenticated Requests

```
Authorization: Bearer <accessToken>
X-CSRF-Token: <csrfToken>  (for POST/PUT/DELETE only)
Content-Type: application/json
```

### Response Headers

```
Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; Path=/
Set-Cookie: csrfToken=...; Secure; SameSite=Strict; Path=/
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1718476800
```

---

## Token Format

### Access Token (JWT)

```
Header:
{
  "alg": "RS256",
  "typ": "JWT"
}

Payload:
{
  "sub": "user-id",
  "email": "user@example.com",
  "sessionId": "session-id",
  "type": "access",
  "iat": 1718473200,
  "exp": 1718474100
}

Signature:
HMACSHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), JWT_SECRET)
```

### Refresh Token (JWT)

```
Header:
{
  "alg": "RS256",
  "typ": "JWT"
}

Payload:
{
  "sub": "user-id",
  "email": "user@example.com",
  "sessionId": "session-id",
  "type": "refresh",
  "iat": 1718473200,
  "exp": 1725249600
}

Signature:
HMACSHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), JWT_SECRET)
```

---

## Rate Limits

### Authentication Endpoints

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/auth/login | 5 attempts | 15 minutes |
| POST /api/auth/refresh | 10 per minute | Per session |
| POST /api/auth/logout | 3 per minute | Per session |
| POST /api/auth/logout-all | 1 per minute | Per session |

### Session Management

| Endpoint | Limit | Window |
|----------|-------|--------|
| GET /api/sessions | 5 per minute | Per user |
| DELETE /api/sessions/:id | 10 per minute | Per user |

Limits enforced by Phase 3 rate limiting middleware.

---

## Example Client Implementation

### React Hook

```typescript
import { useState, useCallback } from "react";

export function useAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include"
      });

      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.session.accessToken);
        setUser(data.user);
        return true;
      }
      return false;
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });
    setAccessToken(null);
    setUser(null);
  }, []);

  return { accessToken, user, login, logout };
}
```

---

## Session Lifecycle

```
1. User logs in
   POST /api/auth/login
   ↓
2. Receives accessToken + refreshToken cookie
   ↓
3. Makes authenticated requests
   GET/POST/PUT/DELETE with Authorization header + CSRF token
   ↓
4. Access token expires (15 min)
   401 response
   ↓
5. Client calls refresh endpoint
   POST /api/auth/refresh (browser sends refreshToken cookie)
   ↓
6. Receives new accessToken + new refreshToken
   Old refreshToken blacklisted
   ↓
7. Retries original request
   ↓
8. User logs out
   POST /api/auth/logout
   ↓
9. Session revoked, tokens blacklisted
   Cookies cleared
   ↓
10. Redirect to login
```

---

## Testing

### Manual Testing with cURL

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' \
  -c cookies.txt \
  -v

# Extract access token from response
export ACCESS_TOKEN="..."

# 2. List sessions
curl -X GET http://localhost:3000/api/sessions \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -b cookies.txt

# 3. Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -b cookies.txt
```

### Integration Tests (Jest)

```typescript
describe("Authentication", () => {
  it("should login and create session", async () => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123"
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.session.accessToken).toBeDefined();
    expect(data.user).toBeDefined();
  });
});
```

---

## Troubleshooting

### Access Token Invalid

**Symptom**: 401 Unauthorized on authenticated requests  
**Solution**: 
1. Check token is in Authorization header
2. Check token format: `Authorization: Bearer <token>`
3. Try refreshing token: `POST /api/auth/refresh`
4. Re-login if refresh fails

### CSRF Token Mismatch

**Symptom**: 403 Forbidden on POST/PUT/DELETE  
**Solution**:
1. Check X-CSRF-Token header is set
2. Verify token matches cookie value
3. Re-login to get fresh CSRF token
4. Check credentials: "include" in fetch

### Cookies Not Persisted

**Symptom**: Refresh token not sent with requests  
**Solution**:
1. Add `credentials: "include"` to fetch options
2. Check domain matches
3. Ensure cookies are enabled
4. Check Secure flag on HTTPS

### Session Expired

**Symptom**: 401 after 7 days  
**Solution**:
1. This is expected (absolute session timeout)
2. User must re-login
3. Can be extended in future phases

---

## See Also

- `PHASE7_SESSION_MANAGEMENT.md` - Architecture and design
- `src/lib/session/` - Token and session libraries
- `src/lib/security/csrfProtection.ts` - CSRF implementation
- `prisma/schema.prisma` - Database schema
