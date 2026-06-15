# Privacy Module (Phase 6)

This module implements HIPAA-compliant privacy controls, encryption, and audit logging for the Personal Psychologist app.

## Structure

```
src/lib/privacy/
├── encryption.ts         # AES-256-GCM encryption for PII
├── auditLog.ts          # HIPAA-compliant append-only audit logging
├── consent.ts           # User consent management and policy tracking
├── anonymization.ts     # HIPAA Safe Harbor de-identification
└── README.md            # This file
```

## Quick Start

### 1. Encryption of Sensitive Data

```typescript
import { encrypt, decrypt } from "@/lib/privacy/encryption";

// Encrypt (called automatically by Prisma middleware)
const encrypted = encrypt("555-1234");

// Decrypt (called automatically by Prisma middleware)
const decrypted = decrypt(encrypted);
console.log(decrypted); // "555-1234"
```

### 2. Audit Logging

```typescript
import { logDataAccess, logDataModification } from "@/lib/privacy/auditLog";

// Log data access (read-only)
await logDataAccess(
  userId,
  "profile",
  userId,
  clientIP,
  userAgent
);

// Log data modification (write)
await logDataModification(
  userId,
  "phone",
  oldPhoneHash,
  newPhoneHash,
  userId,
  clientIP,
  userAgent
);

// View audit logs
const logs = await getUserAuditLog(userId, { limit: 50, offset: 0 });
```

### 3. Consent Management

```typescript
import {
  recordConsent,
  hasConsent,
  getConsentHistory,
  revokeConsent,
  getPoliciesNeedingReconsent,
} from "@/lib/privacy/consent";

// Record user consent
await recordConsent(
  userId,
  "TERMS_OF_SERVICE",
  true,
  clientIP,
  userAgent
);

// Check if user consented
const hasTermsConsent = await hasConsent(userId, "TERMS_OF_SERVICE");

// Get consent history for audit trail
const history = await getConsentHistory(userId);

// Check if policy has been updated
const needsReconsent = await hasConsentVersionChanged(
  userId,
  "PRIVACY_POLICY"
);

// Revoke consent (e.g., withdraw from research)
await revokeConsent(userId, "RESEARCH_SHARING", clientIP, userAgent);
```

### 4. Data Anonymization

```typescript
import {
  anonymizeUserDataForResearch,
  extractMentalHealthThemes,
  createPseudonym,
  aggregateResearchStatistics,
} from "@/lib/privacy/anonymization";

// Anonymize user data for research
const anonymized = anonymizeUserDataForResearch(userId, {
  dateOfBirth: user.dateOfBirth,
  gender: user.gender,
  chatHistory: messages,
  createdAt: user.createdAt,
  lastActivityAt: user.updatedAt,
  messagesCount: messages.length,
  sessionsCount: sessions.length,
});

// Extract themes for aggregation
const themes = extractMentalHealthThemes(chatHistory);

// Create consistent pseudonym for research
const pseudonym = createPseudonym(userId); // Always same for same userId

// Aggregate statistics from multiple users
const stats = aggregateResearchStatistics([
  anonymized1,
  anonymized2,
  anonymized3,
]);
// Result: { totalParticipants: 3, commonThemes: [...], commonStrategies: [...] }
```

## Environment Configuration

### Required

```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY="your-base64-32-byte-key"
```

### Optional (Development)

If `ENCRYPTION_KEY` is not set in development, a fallback key is used (NOT secure for production).

## API Integration

### User Profile API

```typescript
// src/app/api/profile/route.ts
export async function GET(req: NextRequest) {
  // Automatically decrypts phone and dateOfBirth
  const user = await prisma.user.findUnique({ ... });
  return NextResponse.json(user);
}
```

### Privacy Settings API

```typescript
// src/app/api/profile/privacy-settings/route.ts
export async function PUT(req: NextRequest) {
  // Logs modifications automatically
  const settings = await prisma.privacySettings.update({ ... });
  return NextResponse.json(settings);
}
```

### Data Download API

```typescript
// src/app/api/profile/data-download/route.ts
export async function GET(req: NextRequest) {
  // Returns all user data as JSON
  // Logs the export for audit trail
  return new NextResponse(JSON.stringify(dataExport), {
    headers: { "Content-Disposition": "attachment; filename=..." }
  });
}
```

### Account Deletion API

```typescript
// src/app/api/profile/account/route.ts
export async function DELETE(req: NextRequest) {
  // Soft delete with 30-day grace period
  // Audit logs retained forever
  await prisma.user.update({
    data: { deletedAt: now(), hardDeleteAt: now + 30days }
  });
}

// src/app/api/profile/account/hard-delete/route.ts
export async function POST(req: NextRequest) {
  // Hard delete after grace period elapsed
  // Removes all user data except audit logs
  await prisma.user.delete({ ... });
}
```

## Database Middleware

The `src/lib/db.ts` file includes Prisma middleware that automatically:

1. **Encrypts** sensitive fields before saving to database:
   - `User.phone`
   - `User.dateOfBirth`

2. **Decrypts** sensitive fields after retrieving from database:
   - `User.phone`
   - `User.dateOfBirth`

This is transparent to the API routes — you work with plaintext, encryption happens automatically.

## Security Best Practices

### 1. Never Log Plaintext Sensitive Data

```typescript
// ❌ WRONG
console.log("User phone:", user.phone); // Logs plaintext to console/logs

// ✅ CORRECT
console.log("User phone:", hashValue(user.phone)); // Logs hash
await logAuditEntry({ ..., oldValue: hashValue(oldPhone), newValue: hashValue(newPhone) });
```

### 2. Always Anonymize IP Addresses

```typescript
import { anonymizeIP } from "@/lib/privacy/encryption";

// Store anonymized IP (last octet = 0)
const ip = getClientIP(req); // 192.168.1.42
const anonymized = anonymizeIP(ip); // 192.168.1.0
```

### 3. Encrypt Sensitive Fields at Rest

```typescript
// Fields already encrypted via Prisma middleware
await prisma.user.create({
  data: {
    email: "user@example.com", // Not encrypted (indexed)
    phone: "555-1234", // Encrypted automatically
    dateOfBirth: "1990-01-01" // Encrypted automatically
  }
});
```

### 4. Use Audit Logs for Compliance

```typescript
// Every data operation should be logged
await logDataAccess(userId, "profile", ...) // User viewed profile
await logDataModification(userId, "phone", oldValue, newValue, ...) // User updated phone
await logAccountDeletion(userId, "soft", ...) // User deleted account
```

## HIPAA Compliance Checklist

- ✅ Encryption at rest (AES-256-GCM)
- ✅ Encryption in transit (TLS 1.3)
- ✅ Access controls (authentication required)
- ✅ Audit logging (append-only, 6-year retention)
- ✅ Data breach procedures (documented)
- ✅ Secure deletion (soft delete + 30-day grace + hard delete)
- ✅ IP anonymization (last octet zeroed)
- ✅ Minimal data collection (only necessary fields)

## Testing

Run privacy tests:

```bash
npm test -- privacy.test.ts
```

Tests cover:
- Encryption/decryption
- Hash values
- IP anonymization
- Data anonymization
- Theme extraction
- Coping strategy extraction
- Research statistics aggregation

## Troubleshooting

### "ENCRYPTION_KEY environment variable is required in production"

**Solution:** Generate and set `ENCRYPTION_KEY` in `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Copy output to .env ENCRYPTION_KEY=...
```

### "Failed to decrypt [field] for User"

**Possible causes:**
- Key was changed/rotated without migration
- Data was corrupted
- Decryption algorithm mismatch

**Solution:** Check encryption key and data integrity. Consider implementing key versioning for rotation.

### Audit logs not being created

**Check:**
- Database connection is working
- User exists in database
- Sentry errors are not suppressed

```typescript
// Debug
const logs = await getUserAuditLog(userId);
console.log("Audit logs:", logs);
```

## Future Enhancements

1. **Key Rotation:** Implement versioning to support encryption key rotation
2. **Consent Delegation:** Allow users to delegate consent to guardians
3. **Research Marketplace:** Monetize anonymized research data
4. **Automated Retention:** Auto-delete data after user-specified period
5. **Cryptographic Signatures:** Sign audit logs to prevent tampering

## References

- [HIPAA Encryption Standards](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [GDPR Data Protection](https://gdpr-info.eu/)
- [NIST AES Recommendation](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf)
- [OWASP Encryption Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

## Contact

For security issues or privacy concerns:
- Email: privacy@personal-psychologist.app
- Security: security@personal-psychologist.app
