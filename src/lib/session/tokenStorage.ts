/**
 * Phase 7: Token Storage Best Practices
 * Documentation and utilities for secure token storage:
 * - Access token: Memory only (cleared on page reload)
 * - Refresh token: httpOnly secure cookie (never accessible to JS)
 * - CSRF token: Regular cookie (accessible to JS for form submission)
 */

/**
 * SECURITY PRINCIPLES
 *
 * 1. REFRESH TOKEN (Long-lived, 7-14 days)
 *    - Stored ONLY in httpOnly, Secure, SameSite=Strict cookie
 *    - NEVER in localStorage (accessible to XSS)
 *    - NEVER in sessionStorage
 *    - NEVER returned to client in response body
 *    - Only sent automatically by browser with requests
 *    - Used only for refreshing access token
 *
 * 2. ACCESS TOKEN (Short-lived, 15 minutes)
 *    - Returned in response body (not in cookie)
 *    - Stored in memory (React state variable)
 *    - NOT persisted (cleared on page reload)
 *    - Sent in Authorization: Bearer header
 *    - If expired, use refresh token to get new access token
 *
 * 3. CSRF TOKEN (Protection for form submissions)
 *    - Stored in regular (non-httpOnly) cookie
 *    - Also stored in HTML form or JS variable
 *    - Required for POST/PUT/DELETE requests
 *    - Sent in X-CSRF-Token header or form body
 *    - Regenerated after each validation
 *
 * 4. ATTACK PREVENTION
 *    - XSS: httpOnly cookies prevent JS access to refresh token
 *    - CSRF: SameSite=Strict + CSRF token validation
 *    - Token Reuse: Refresh token rotation invalidates old token
 *    - Token Leakage: No sensitive data in localStorage
 *    - Subdomain Attacks: Secure cookie flags prevent cross-domain
 */

/**
 * CLIENT-SIDE STORAGE PATTERNS
 *
 * React hooks for managing token storage:
 */

/**
 * Example: Hook for managing access token in memory
 * Never persist this to localStorage!
 */
export function useAccessToken() {
  // In a real app, use React Context or Zustand/Redux
  // Example:
  // const [accessToken, setAccessToken] = useState<string | null>(null);
  // const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  // When login response received:
  // setAccessToken(response.accessToken);
  // setExpiresAt(response.expiresAt);

  // On page reload:
  // accessToken is cleared (lost)
  // Refresh endpoint will use httpOnly cookie to get new access token

  return {
    // accessToken,
    // expiresAt,
    // setAccessToken,
  };
}

/**
 * Example: Request with access token
 *
 * const response = await fetch("/api/chat", {
 *   method: "POST",
 *   headers: {
 *     "Authorization": `Bearer ${accessToken}`,
 *     "Content-Type": "application/json",
 *     "X-CSRF-Token": csrfToken,
 *   },
 *   credentials: "include", // Include cookies
 *   body: JSON.stringify({ message: "..." }),
 * });
 */

/**
 * Example: Handle token expiration
 *
 * if (response.status === 401) {
 *   // Access token expired
 *   // Call refresh endpoint (uses httpOnly refresh token cookie)
 *   const refreshResponse = await fetch("/api/auth/refresh", {
 *     method: "POST",
 *     credentials: "include",
 *   });
 *
 *   if (refreshResponse.ok) {
 *     const { accessToken } = await refreshResponse.json();
 *     setAccessToken(accessToken);
 *     // Retry original request
 *   } else {
 *     // Refresh failed, redirect to login
 *     redirect("/login");
 *   }
 * }
 */

/**
 * SECURITY HEADERS
 * Should be set in next.config.js or via middleware:
 *
 * - Content-Security-Policy: Restrict script sources (prevent XSS)
 * - X-Content-Type-Options: nosniff (prevent MIME sniffing)
 * - X-Frame-Options: DENY (prevent clickjacking)
 * - X-XSS-Protection: 1; mode=block (legacy XSS protection)
 * - Strict-Transport-Security: max-age=... (HTTPS only)
 */

/**
 * COOKIE FLAGS REFERENCE
 *
 * httpOnly: true
 *   - Cookie not accessible via document.cookie
 *   - Prevents XSS access to sensitive tokens
 *   - Browser automatically includes with requests
 *
 * Secure: true
 *   - Cookie only sent over HTTPS
 *   - Not sent over HTTP
 *   - Must be true in production
 *
 * SameSite: "Strict" | "Lax" | "None"
 *   - Strict: Cookie sent only for same-site requests
 *   - Lax: Cookie sent for top-level navigations from other sites
 *   - None: Cookie sent for all requests (requires Secure flag)
 *   - Use "Strict" for sensitive tokens
 *
 * Path: "/"
 *   - Cookie sent to all paths under domain
 *   - More restrictive paths reduce exposure
 *
 * Domain: undefined (or specific domain)
 *   - Cookie sent only to specified domain
 *   - Subdomains included if Domain is set
 *   - Don't set Domain to limit to exact domain
 *
 * MaxAge / Expires:
 *   - How long cookie persists
 *   - Access token expiry ≠ cookie expiry
 *   - Cookie should live at least as long as token
 */

/**
 * LOGOUT IMPLEMENTATION
 *
 * 1. Clear access token from memory (state)
 * 2. Delete refresh token cookie on server
 * 3. Add token(s) to blacklist in database
 * 4. Redirect to login page
 *
 * POST /api/auth/logout
 * - Takes current session ID
 * - Revokes session in database
 * - Sends Set-Cookie header to clear refreshToken
 * - Returns success
 */

/**
 * TOKEN ROTATION FLOW
 *
 * 1. Client sends refresh token cookie with POST /api/auth/refresh
 * 2. Server verifies refresh token signature
 * 3. Server checks token not in blacklist
 * 4. Server checks session not revoked
 * 5. Server generates new access token
 * 6. Server generates new refresh token (token rotation)
 * 7. Server blacklists old refresh token
 * 8. Server returns new access token in body
 * 9. Server sets new refresh token in httpOnly cookie
 * 10. Client stores new access token in memory
 * 11. Old refresh token can't be reused (in blacklist)
 */

/**
 * MULTI-DEVICE SESSION HANDLING
 *
 * - Each device gets its own session ID
 * - Each session has independent tokens
 * - Logout from one device doesn't affect others
 * - User can view all active sessions
 * - User can revoke specific session
 * - GET /api/sessions - List all active sessions
 * - DELETE /api/sessions/[sessionId] - Revoke one device
 * - POST /api/auth/logout-all - Logout all devices
 */

/**
 * Helper: Clear tokens on logout
 * Call from client after logout API call succeeds
 */
export function clearAuthTokens() {
  // Clear access token from memory (React state)
  // This is app-specific, so not implemented here

  // Refresh token is cleared via Set-Cookie on logout endpoint
  // CSRF token is cleared via Set-Cookie on logout endpoint

  // Clear any localStorage (if using for non-auth purposes)
  // if (typeof window !== "undefined") {
  //   localStorage.removeItem("accessToken"); // Should NOT store this
  // }
}

/**
 * Recommendations summary:
 *
 * DO:
 * - Use httpOnly cookies for sensitive tokens
 * - Use Secure flag (HTTPS only) in production
 * - Use SameSite=Strict for protection
 * - Store access token in memory only
 * - Rotate refresh tokens on use
 * - Validate CSRF tokens on POST/PUT/DELETE
 * - Clear cookies on logout
 * - Use short expiry for access tokens (15 min)
 *
 * DON'T:
 * - Store tokens in localStorage
 * - Store tokens in sessionStorage
 * - Store sensitive data in URL parameters
 * - Use SameSite=None unless necessary
 * - Rely only on token expiry for logout
 * - Reuse refresh tokens
 * - Store plaintext tokens in database
 * - Skip CSRF validation on state-changing requests
 */
