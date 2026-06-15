# Phase 6: User Profiles & Privacy (HIPAA-Compliant Implementation)

## Overview

Phase 6 implements user profile management and HIPAA-compliant privacy controls for the Personal Psychologist app. This phase introduces:

- **User profiles** with encrypted PII (phone, date of birth)
- **Privacy controls** (download data, delete account, opt-out of research)
- **Consent management** (track policy agreements and withdrawals)
- **HIPAA-compliant audit logging** (6-year retention, append-only)
- **Data anonymization** (HIPAA Safe Harbor de-identification)
- **Multi-device session management** (revoke specific sessions)

## Database Schema Extensions

### Models Added

1. **User** (extended)
   - `firstName`, `lastName` (optional, plain text)
   - `dateOfBirth` (optional, encrypted at rest)
   - `phone` (optional, encrypted at rest)
   - `preferences` (JSON for theme, notifications, language)
   - `deletedAt` (soft delete timestamp)
   - `hardDeleteAt` (scheduled hard delete after 30 days)

2. **UserProfile**
   - `bio` (optional user biography)
   - `avatar` (optional URL or base64 image)
   - `privacyLevel` (PUBLIC, PRIVATE, RESEARCH_ONLY)

3. **PrivacySettings**
   - `dataCollectionOptIn` (allow analytics, default: true)
   - `shareWithResearch` (allow anonymized data for research, default: false)
   - `marketingEmails` (allow marketing emails, default: false)

4. **ConsentLog** (append-only)
   - Tracks every consent agreement signed
   - Includes policy version for change tracking
   - Stores anonymized IP and user agent

5. **AuditLog** (append-only, HIPAA-required)
   - Logs all data access, modifications, deletions
   - Hashes sensitive values (phone, email, SSN)
   - 6-year retention per HIPAA requirements
   - Append-only (no updates/deletes)

6. **AuthSession** (Phase 7 - multi-device support)
   - Track active sessions per device
   - Revoke specific sessions
   - Anonymized location and device info

## Key Features

### 1. PII Encryption (AES-256-GCM)

**File:** `src/lib/privacy/encryption.ts`

- Transparent encryption/decryption via Prisma middleware
- Supports key rotation (version tracking)
- Handles encryption failures gracefully
- Never logs encrypted data in plaintext

```typescript
// Usage in Prisma
const user = await prisma.user.create({
  data: {
    email: "user@example.com",
    phone: "555-1234",  // Auto-encrypted via middleware
    dateOfBirth: "1990-01-01"  // Auto-encrypted via middleware
  }
});

// Decryption happens automatically on retrieval
const user = await prisma.user.findUnique({ where: { id: "..." } });
console.log(user.phone); // Decrypted value
```

### 2. HIPAA Audit Logging

**File:** `src/lib/privacy/auditLog.ts`

Logs all data operations with:
- **Action:** DATA_ACCESS, DATA_MODIFICATION, PROFILE_UPDATE, EXPORT, DELETE, SESSION_*
- **Resource:** profile, email, phone, chat_history, account
- **Sensitive values:** Automatically hashed before logging
- **IP anonymization:** Last octet zeroed (e.g., 192.168.1.0)
- **Immutable:** Append-only, no updates/deletes

```typescript
// Log data access
await logDataAccess(
  userId,
  "profile",
  userId,
  clientIP,
  userAgent
);

// Log data modification
await logDataModification(
  userId,
  "phone",
  oldPhoneHash,
  newPhoneHash,
  userId,
  clientIP,
  userAgent
);
```

### 3. User Consent Management

**File:** `src/lib/privacy/consent.ts`

Tracks explicit consent for:
- Terms of Service (v1.0, v1.1, ...)
- Privacy Policy (v1.0, v1.1, ...)
- Research Sharing (v1.0, v1.1, ...)
- Marketing Emails (v1.0, v1.1, ...)

Features:
- Version tracking (detect when user needs to re-consent)
- Consent history (full audit trail)
- One-way consent withdrawal
- Policy content management

```typescript
// Record consent
await recordConsent(userId, "TERMS_OF_SERVICE", true, ip, userAgent);

// Check if user consented
const hasConsent = await hasConsent(userId, "PRIVACY_POLICY");

// Get policies needing re-consent
const policiesNeedingReconsent = await getPoliciesNeedingReconsent(userId);
```

### 4. Data Anonymization (HIPAA Safe Harbor)

**File:** `src/lib/privacy/anonymization.ts`

Implements HIPAA's Safe Harbor de-identification method:
- Removes 18 HIPAA-identified elements
- Extracts mental health themes (anxiety, depression, stress, etc.)
- Identifies coping strategies mentioned
- Creates consistent pseudonyms for research

```typescript
// Anonymize for research
const anonymizedData = anonymizeUserDataForResearch(userId, {
  dateOfBirth: user.dateOfBirth,
  chatHistory: messages,
  createdAt: user.createdAt,
  lastActivityAt: user.updatedAt,
  messagesCount: messages.length,
  sessionsCount: sessions.length
});

// Aggregate research statistics
const stats = aggregateResearchStatistics([
  anonymized1,
  anonymized2,
  anonymized3
]);
```

## API Routes

### Profile Management

- **GET /api/profile** - Get user's profile
- **PUT /api/profile** - Update profile (firstName, lastName, preferences)
- **GET /api/profile/privacy-settings** - Get privacy preferences
- **PUT /api/profile/privacy-settings** - Update privacy settings
- **GET /api/profile/consent-history** - View all consent agreements
- **POST /api/profile/consent-history** - Record new consent
- **GET /api/profile/audit-log** - View access history (sanitized)

### Data Operations

- **GET /api/profile/data-download** - Export all user data (JSON)
- **DELETE /api/profile/account** - Request soft deletion (30-day grace)
- **POST /api/profile/account/hard-delete** - Permanent deletion after grace period

### Session Management

- **GET /api/profile/sessions** - List active sessions
- **DELETE /api/profile/sessions/:id** - Revoke specific session

## Configuration

### Environment Variables

```bash
# Base64-encoded 32-byte AES-256 encryption key
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY="your-base64-32-byte-key-here"
```

### Rate Limiting (Integrated with Phase 3)

```typescript
// Example: 10 profile updates per hour (to be added to middleware)
const profileUpdateLimiter = new Bottleneck({
  minTime: 1000 * 60 * 6, // 10 updates per hour
  maxConcurrent: 1
});
```

## Privacy Policy & Terms of Service

### Pages Created

- `src/app/privacy/page.tsx` - Comprehensive GDPR/CCPA/HIPAA-compliant privacy policy
- `src/app/terms/page.tsx` - Terms of service with liability disclaimers

### Key Sections

**Privacy Policy:**
- Data collection practices
- Encryption and security measures
- Data retention policies
- User rights (GDPR/CCPA)
- HIPAA considerations
- Research sharing
- Third-party services

**Terms of Service:**
- Use license restrictions
- Medical/mental health disclaimers
- Crisis resources (988, Crisis Text Line)
- Limitation of liability
- Account termination policy

## Security & Compliance

### HIPAA Compliance

✅ **Implemented:**
- Audit logging (append-only, 6-year retention)
- Encryption at rest (AES-256-GCM)
- Encryption in transit (TLS 1.3)
- Access controls (authentication required)
- Data breach notification procedures
- Secure deletion (soft delete + 30-day grace + hard delete)

❌ **Not Applicable (Not a Covered Entity):**
- Business Associate Agreement (BAA)
- HIPAA designation of user as "patient"
- Medical record requirements

**Note:** Users are advised to consult licensed mental health professionals for clinical care.

### GDPR Compliance

✅ **Implemented:**
- Right to access (data download)
- Right to delete (soft + hard delete)
- Right to opt-out (research sharing, marketing)
- Right to data portability (JSON export)
- Right to rectification (profile updates)
- Legitimate interest (audit logging)

### CCPA Compliance

✅ **Implemented:**
- Opt-out of data sharing (research participation)
- Data access and deletion rights
- Non-discrimination for exercising rights
- Transparent data practices

## Testing

### Unit Tests for Encryption

```typescript
import { testEncryption } from "@/lib/privacy/encryption";

// In your test file
describe("Encryption", () => {
  it("should encrypt and decrypt data", () => {
    expect(testEncryption()).toBe(true);
  });
});
```

### Integration Tests for Audit Logging

```typescript
import { logAuditEntry, getUserAuditLog } from "@/lib/privacy/auditLog";

describe("Audit Logging", () => {
  it("should log data access", async () => {
    await logAuditEntry({
      userId: "test-user",
      action: "DATA_ACCESS",
      resourceType: "profile",
      performedBy: "test-user",
      reason: "Testing"
    });

    const logs = await getUserAuditLog("test-user");
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("DATA_ACCESS");
  });
});
```

## Migration Steps

### 1. Install Dependencies (if needed)

```bash
npm install
```

### 2. Generate Encryption Key (Production)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Copy output to .env ENCRYPTION_KEY
```

### 3. Run Prisma Migration

```bash
# With migration file provided
npx prisma migrate dev --name phase6_user_profiles_privacy

# Or use the SQL migration directly
psql -h localhost -U psych -d psych -f prisma/migrations/phase6_user_profiles_privacy.sql
```

### 4. Verify Schema

```bash
npx prisma studio  # View database in UI
```

## Future Enhancements

### Phase 7 (Session Management)
- Complete AuthSession implementation
- Device management UI
- Geographic login alerts
- Session activity timeline

### Phase 8 (Advanced Privacy)
- Data retention policies (auto-delete after X days)
- GDPR right to be forgotten (automated)
- Breach notification system
- Privacy impact assessments

### Phase 9 (Research Sharing)
- Research data marketplace
- Consent delegation
- Researcher access portal
- De-identification verification

## Rate Limiting

Profile-related endpoints should have rate limits:

```typescript
// To be integrated with Phase 3 rate limiting
const PROFILE_RATE_LIMITS = {
  profileUpdates: "10 per hour", // Prevents spam
  dataDownloads: "1 per hour", // Prevents abuse
  accountDeletion: "1 per week", // Prevents accidents
  consentChanges: "5 per day" // Prevents manipulation
};
```

## Error Handling

All privacy operations include:
- Sentry error tracking
- Graceful failure modes
- User-friendly error messages
- Audit log of failures

```typescript
try {
  await encryptedOperation();
} catch (error) {
  console.error("[ENCRYPTION] Failed:", error);
  captureException(error, {
    tags: { category: "encryption_failure" }
  });
  // Return user-friendly error
}
```

## Monitoring & Alerts

### Audit Log Monitoring

Set up Sentry alerts for:
- Multiple failed login attempts
- Rapid data downloads (potential exfiltration)
- Bulk data modifications
- Suspicious session creation
- Access from unusual locations

### Encryption Key Management

- Rotate key annually (recommended)
- Store in secure vault (not in code)
- Test key rotation procedure quarterly
- Document key versions

## References

- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa)
- [GDPR Data Protection](https://gdpr-info.eu/)
- [CCPA Consumer Privacy](https://oag.ca.gov/privacy/ccpa)
- [NIST Encryption Standards](https://csrc.nist.gov)

## Contact

For privacy concerns or security issues, contact:
- Email: privacy@personal-psychologist.app
- Security: security@personal-psychologist.app
