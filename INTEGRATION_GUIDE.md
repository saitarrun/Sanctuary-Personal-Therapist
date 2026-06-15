# Phase 6 Integration Guide

This guide explains how to integrate Phase 6 privacy features with existing code (Phase 5 Auth and Phase 3 Rate Limiting).

## Overview

Phase 6 is **ready for integration** with minimal changes to existing code.

## Step 1: Set Up Environment Variables

### Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Add to .env
```bash
# Copy the output above
ENCRYPTION_KEY="your-generated-base64-key-here"
```

## Step 2: Run Database Migration

```bash
# Option A: Using Prisma migration
npx prisma migrate dev --name phase6_user_profiles_privacy

# Option B: Using raw SQL (if migration file exists)
psql -h localhost -U psych -d psych -f prisma/migrations/phase6_user_profiles_privacy.sql
```

### Verify Migration
```bash
npx prisma studio  # Opens Prisma UI to view database
```

## Step 3: Update Authentication Integration

Currently, Phase 6 API routes expect a temporary `x-user-id` header. Replace with actual auth session:

### In `src/app/api/profile/route.ts` (and other API files)

**Current:**
```typescript
const userId = req.headers.get("x-user-id");
if (!userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**Replace with (from Phase 5 auth):**
```typescript
const session = await getSession(req);
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const userId = session.user.id;
```

**Where `getSession` is from your Phase 5 authentication:**
```typescript
// Example: If using next-auth
import { getServerSession } from "next-auth/next";
const session = await getServerSession(authOptions);

// Or your custom session getter
import { getSession } from "@/lib/auth";
const session = await getSession(req);
```

## Step 4: Integrate Rate Limiting (Phase 3)

Add rate limits for profile-related endpoints in your middleware:

### In `src/middleware.ts`

```typescript
import { getProfileEndpointLimiter } from "@/lib/rateLimit/limiter";

// In middleware function
if (endpoint === "/api/profile/data-download") {
  const limiter = getProfileEndpointLimiter("data-download");
  const result = limiter.check(endpointKey); // 1 per hour
  if (!result.allowed) {
    return createRateLimitResponse(result.retryAfter!);
  }
}

if (endpoint === "/api/profile/account") {
  const limiter = getProfileEndpointLimiter("account-delete");
  const result = limiter.check(endpointKey); // 1 per week
  if (!result.allowed) {
    return createRateLimitResponse(result.retryAfter!);
  }
}
```

### Create Limiter Configuration

In `src/lib/rateLimit/limiter.ts`, add:

```typescript
// Profile endpoint limits
export function getProfileEndpointLimiter(type: string) {
  if (type === "data-download") {
    return new Bottleneck({
      minTime: 1000 * 60 * 60, // 1 per hour
      maxConcurrent: 1
    });
  }
  
  if (type === "account-delete") {
    return new Bottleneck({
      minTime: 1000 * 60 * 60 * 24 * 7, // 1 per week
      maxConcurrent: 1
    });
  }
  
  // Default for profile updates
  return new Bottleneck({
    minTime: 1000 * 60 * 6, // 10 per hour
    maxConcurrent: 1
  });
}
```

## Step 5: Test the Integration

### 1. Unit Tests
```bash
npm test -- privacy.test.ts
```

### 2. Integration Test
```bash
# Create a test user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Get user ID from auth (replace with actual)
USER_ID="your-test-user-id"

# Test profile endpoint
curl -X GET http://localhost:3000/api/profile \
  -H "x-user-id: $USER_ID"

# Test data download
curl -X GET http://localhost:3000/api/profile/data-download \
  -H "x-user-id: $USER_ID" \
  -o data.json

# Test account deletion
curl -X DELETE http://localhost:3000/api/profile/account \
  -H "x-user-id: $USER_ID" \
  -H "Content-Type: application/json"
```

## Step 6: Create Initial Consent Records

When user signs up, automatically record initial consents:

### In `src/app/api/auth/register` (Phase 5)

```typescript
import { recordConsent } from "@/lib/privacy/consent";
import { getClientIP } from "@/lib/rateLimit/requestUtils";

export async function POST(req: NextRequest) {
  // ... existing registration code ...

  // After user is created, record consent
  const ip = getClientIP(req);
  const userAgent = req.headers.get("user-agent") || undefined;

  // Record required consents
  await recordConsent(
    newUser.id,
    "TERMS_OF_SERVICE",
    true, // User must accept to register
    ip,
    userAgent
  );

  await recordConsent(
    newUser.id,
    "PRIVACY_POLICY",
    true, // User must accept to register
    ip,
    userAgent
  );

  // Create default privacy settings
  await prisma.privacySettings.create({
    data: {
      userId: newUser.id,
      dataCollectionOptIn: true,
      shareWithResearch: false,
      marketingEmails: false,
    },
  });

  // Create default user profile
  await prisma.userProfile.create({
    data: {
      userId: newUser.id,
    },
  });

  // Rest of registration...
}
```

## Step 7: Add Consent Check at Login

Check if user needs to re-consent to updated policies:

### In `src/app/api/auth/login` (Phase 5)

```typescript
import { getPoliciesNeedingReconsent } from "@/lib/privacy/consent";

export async function POST(req: NextRequest) {
  // ... existing login code ...

  // Check for policies needing re-consent
  const policiesNeedingReconsent = await getPoliciesNeedingReconsent(
    authenticatedUser.id
  );

  return NextResponse.json({
    user: authenticatedUser,
    token: jwtToken,
    // Tell client which policies need re-consent
    policiesNeedingReconsent,
  });
}
```

### On Client Side

```typescript
// In your login component
const response = await fetch("/api/auth/login", { ... });
const data = await response.json();

if (data.policiesNeedingReconsent.length > 0) {
  // Show consent modal for updated policies
  navigate("/consent", { 
    state: { policies: data.policiesNeedingReconsent } 
  });
} else {
  // Login normally
  navigate("/chat");
}
```

## Step 8: Create Consent UI Pages

Create pages for users to view and sign policies:

### Create `src/app/consent/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { recordConsent } from "@/lib/privacy/consent";

export default function ConsentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const policies = searchParams.get("policies")?.split(",") || [];
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  const handleAccept = async () => {
    const userId = "current-user-id"; // Get from session

    for (const policy of policies) {
      await recordConsent(userId, policy, true);
    }

    router.push("/chat");
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Review Updated Policies</h1>

      {policies.includes("TERMS_OF_SERVICE") && (
        <PolicySection title="Terms of Service" policyId="TERMS_OF_SERVICE" />
      )}

      {policies.includes("PRIVACY_POLICY") && (
        <PolicySection title="Privacy Policy" policyId="PRIVACY_POLICY" />
      )}

      <button
        onClick={handleAccept}
        disabled={!allAccepted(accepted, policies)}
        className="mt-8 bg-blue-600 text-white px-8 py-3 rounded-lg disabled:opacity-50"
      >
        I Accept & Continue
      </button>
    </div>
  );
}

function PolicySection({ title, policyId }: { title: string; policyId: string }) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="mb-8 border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="bg-gray-50 h-64 overflow-y-auto p-4 mb-4 text-sm">
        {/* Load policy content from getPolicyContent(policyId) */}
      </div>
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mr-2"
        />
        <span>I have read and agree to the {title}</span>
      </label>
    </div>
  );
}
```

## Step 9: Update User Settings Page

Add privacy controls to user profile/settings page:

### Create `src/app/profile/settings/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";

export default function PrivacySettingsPage() {
  const [settings, setSettings] = useState(null);
  const [consentHistory, setConsentHistory] = useState([]);

  useEffect(() => {
    // Fetch privacy settings
    fetch("/api/profile/privacy-settings")
      .then((r) => r.json())
      .then(setSettings);

    // Fetch consent history
    fetch("/api/profile/consent-history")
      .then((r) => r.json())
      .then((data) => setConsentHistory(data.history));
  }, []);

  const handleDataDownload = async () => {
    const response = await fetch("/api/profile/data-download");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-data.json";
    a.click();
  };

  const handleDeleteAccount = async () => {
    if (confirm("Are you sure? You have 30 days to recover.")) {
      await fetch("/api/profile/account", { method: "DELETE" });
      alert("Account scheduled for deletion");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Privacy & Settings</h1>

      {/* Download Data */}
      <section className="mb-8 border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Download Your Data</h2>
        <p className="text-gray-600 mb-4">
          Download all your personal data and chat history in JSON format.
        </p>
        <button
          onClick={handleDataDownload}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg"
        >
          Download Data
        </button>
      </section>

      {/* Privacy Settings */}
      <section className="mb-8 border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Privacy Preferences</h2>
        {/* Render privacy settings UI */}
      </section>

      {/* Consent History */}
      <section className="mb-8 border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Consent History</h2>
        <ul className="space-y-2">
          {consentHistory.map((log) => (
            <li key={log.id} className="text-sm text-gray-600">
              {log.consentType}: {log.consented ? "✓ Accepted" : "✗ Revoked"} on{" "}
              {new Date(log.givenAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      </section>

      {/* Delete Account */}
      <section className="mb-8 border border-red-300 rounded-lg p-6 bg-red-50">
        <h2 className="text-xl font-semibold mb-4 text-red-700">Danger Zone</h2>
        <p className="text-gray-600 mb-4">
          Request account deletion. You'll have 30 days to recover.
        </p>
        <button
          onClick={handleDeleteAccount}
          className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
        >
          Delete Account
        </button>
      </section>
    </div>
  );
}
```

## Step 10: Add Links to Privacy Pages

Update your navigation/footer to link to privacy pages:

```typescript
// In your layout or footer component
<nav>
  <a href="/privacy">Privacy Policy</a>
  <a href="/terms">Terms of Service</a>
  <a href="/profile/settings">Privacy Settings</a>
</nav>
```

## Verification Checklist

- [ ] Encryption key generated and set in `.env`
- [ ] Database migration run successfully
- [ ] Privacy module tests passing
- [ ] Authentication integration updated
- [ ] Rate limiting configured for profile endpoints
- [ ] Initial consent records created at registration
- [ ] Consent check implemented at login
- [ ] Consent UI page created
- [ ] Privacy settings page created
- [ ] Privacy/Terms pages linked in navigation
- [ ] Data download tested
- [ ] Account deletion tested

## Common Issues & Fixes

### "ENCRYPTION_KEY environment variable is required in production"

**Fix:** Generate and add encryption key to `.env`
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Copy output to .env ENCRYPTION_KEY=...
```

### "x-user-id header required" in API tests

**Fix:** Replace with actual authentication session from Phase 5

### Decryption errors after deployment

**Possible causes:**
- Encryption key changed
- Data was encrypted with different key
- Database connection issue

**Fix:** Verify encryption key hasn't changed. If it has, you'll need to re-encrypt the data.

### Privacy settings endpoint returns 404

**Fix:** Make sure Prisma migration ran successfully:
```bash
npx prisma migrate status
npx prisma migrate dev --name phase6_user_profiles_privacy
```

## Next Steps

1. **Phase 7 (Session Management):** 
   - Complete AuthSession implementation
   - Device management UI
   - Session activity timeline

2. **Phase 8 (Advanced Privacy):**
   - Data retention policies
   - Automated GDPR right to be forgotten
   - Privacy impact assessments

3. **Phase 9 (Research Sharing):**
   - Research data marketplace
   - Researcher access portal
   - De-identification verification

## Support

- Phase 6 Documentation: `PHASE_6_IMPLEMENTATION.md`
- Privacy Module Guide: `src/lib/privacy/README.md`
- Tests: `tests/privacy.test.ts`
- Summary: `PHASE_6_SUMMARY.md`

---

**Ready for Integration!**

Phase 6 is complete and ready to integrate with Phase 5 (Authentication) and Phase 3 (Rate Limiting).
