/**
 * User consent management
 * Tracks explicit consent for Terms, Privacy Policy, Research Sharing, Marketing
 * Supports version tracking and consent withdrawal
 */

import { PrismaClient, ConsentType } from "@prisma/client";
import { anonymizeIP } from "./encryption";
import { captureException } from "@sentry/nextjs";

const prisma = new PrismaClient();

export type ConsentTypeValues = keyof typeof ConsentType;

export interface ConsentRecord {
  consentType: ConsentTypeValues;
  version: string; // e.g., "v1.0", "v1.1"
  consented: boolean;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Current policy versions — update these when policies change
 */
export const CURRENT_POLICY_VERSIONS = {
  TERMS_OF_SERVICE: "v1.0",
  PRIVACY_POLICY: "v1.0",
  RESEARCH_SHARING: "v1.0",
  MARKETING_EMAILS: "v1.0",
};

/**
 * Record user consent
 */
export async function recordConsent(
  userId: string,
  consentType: ConsentTypeValues,
  consented: boolean,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  try {
    const version = CURRENT_POLICY_VERSIONS[consentType];
    const anonymizedIP = ipAddress ? anonymizeIP(ipAddress) : null;

    await prisma.consentLog.create({
      data: {
        userId,
        consentType: ConsentType[consentType],
        version,
        consented,
        ipAddress: anonymizedIP,
        userAgent,
      },
    });

    return true;
  } catch (error) {
    console.error(
      `[CONSENT] Failed to record consent for user ${userId}:`,
      error
    );
    captureException(error, {
      tags: { category: "consent_recording_failure" },
      extra: { userId, consentType },
    });
    return false;
  }
}

/**
 * Check if user has given consent for a specific type
 * Returns the most recent consent status
 */
export async function hasConsent(
  userId: string,
  consentType: ConsentTypeValues
): Promise<boolean> {
  try {
    const latestConsent = await prisma.consentLog.findFirst({
      where: {
        userId,
        consentType: ConsentType[consentType],
      },
      orderBy: { givenAt: "desc" },
    });

    return latestConsent?.consented ?? false;
  } catch (error) {
    console.error(
      `[CONSENT] Failed to check consent for user ${userId}:`,
      error
    );
    return false;
  }
}

/**
 * Check if user has given all required consents
 * Required: TERMS_OF_SERVICE, PRIVACY_POLICY
 * Optional: RESEARCH_SHARING, MARKETING_EMAILS
 */
export async function hasAllRequiredConsents(userId: string): Promise<boolean> {
  const requiredConsents = [
    "TERMS_OF_SERVICE" as ConsentTypeValues,
    "PRIVACY_POLICY" as ConsentTypeValues,
  ];

  for (const consentType of requiredConsents) {
    const hasIt = await hasConsent(userId, consentType);
    if (!hasIt) {
      return false;
    }
  }

  return true;
}

/**
 * Get all consent records for a user (for audit trail)
 */
export async function getConsentHistory(userId: string): Promise<any[]> {
  try {
    const history = await prisma.consentLog.findMany({
      where: { userId },
      orderBy: { givenAt: "desc" },
      select: {
        id: true,
        consentType: true,
        version: true,
        consented: true,
        givenAt: true,
        // Don't expose IP/userAgent in the API response
      },
    });

    return history;
  } catch (error) {
    console.error(
      `[CONSENT] Failed to fetch consent history for user ${userId}:`,
      error
    );
    captureException(error, {
      tags: { category: "consent_history_fetch_failure" },
      extra: { userId },
    });
    return [];
  }
}

/**
 * Revoke consent for a specific type
 */
export async function revokeConsent(
  userId: string,
  consentType: ConsentTypeValues,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  return recordConsent(userId, consentType, false, ipAddress, userAgent);
}

/**
 * Check if consent version has changed since user's last consent
 * If policy has been updated, prompt user to re-consent
 */
export async function hasConsentVersionChanged(
  userId: string,
  consentType: ConsentTypeValues
): Promise<boolean> {
  try {
    const latestConsent = await prisma.consentLog.findFirst({
      where: {
        userId,
        consentType: ConsentType[consentType],
        consented: true,
      },
      orderBy: { givenAt: "desc" },
    });

    const currentVersion = CURRENT_POLICY_VERSIONS[consentType];

    return latestConsent?.version !== currentVersion;
  } catch (error) {
    console.error(
      `[CONSENT] Failed to check version change for user ${userId}:`,
      error
    );
    return false;
  }
}

/**
 * Get all policy versions that need re-consent
 */
export async function getPoliciesNeedingReconsent(userId: string): Promise<ConsentTypeValues[]> {
  const policiesNeedingReconsent: ConsentTypeValues[] = [];

  for (const [consentType] of Object.entries(CURRENT_POLICY_VERSIONS)) {
    const hasChanged = await hasConsentVersionChanged(
      userId,
      consentType as ConsentTypeValues
    );
    if (hasChanged) {
      policiesNeedingReconsent.push(consentType as ConsentTypeValues);
    }
  }

  return policiesNeedingReconsent;
}

/**
 * Get policy content by type and version
 * In production, these would be fetched from a content management system
 */
export function getPolicyContent(
  consentType: ConsentTypeValues,
  version: string
): string {
  const policies: Record<string, Record<string, string>> = {
    TERMS_OF_SERVICE: {
      "v1.0": `# Terms of Service

By using Personal Psychologist, you agree to these terms. This app is not a replacement for professional mental health care.

## Limitation of Liability
Personal Psychologist is provided for educational and informational purposes only. It does not provide medical, psychological, or mental health services. In case of crisis, please contact emergency services.

## User Responsibilities
You agree to use this app lawfully and not to:
- Share your account credentials
- Attempt to breach security
- Use the app for any illegal purpose

## Data Privacy
See our Privacy Policy for information about how we collect, store, and protect your data.`,
      "v1.1": `# Terms of Service (Updated)

By using Personal Psychologist, you agree to these terms. This app is not a replacement for professional mental health care.

## Limitation of Liability
Personal Psychologist is provided for educational and informational purposes only. It does not provide medical, psychological, or mental health services. In case of crisis, please contact emergency services or call the 988 Suicide & Crisis Lifeline.

## User Responsibilities
You agree to use this app lawfully and not to:
- Share your account credentials
- Attempt to breach security
- Use the app for any illegal purpose
- Harass or threaten other users

## Data Privacy
See our Privacy Policy for information about how we collect, store, and protect your data.

## Modifications
We may update these terms at any time. Continued use of the service constitutes acceptance of new terms.`,
    },
    PRIVACY_POLICY: {
      "v1.0": `# Privacy Policy

## What Data We Collect
- Email address (required for account)
- Chat messages (to improve the service)
- Optional: Name, date of birth, phone number

## How We Use Your Data
- To provide the coaching service
- To improve our recommendations
- To detect and prevent abuse (if enabled)

## Data Storage
- Your data is encrypted at rest using AES-256-GCM
- Data is stored securely in PostgreSQL
- We do not share your data with third parties

## Your Rights (GDPR/CCPA)
- Right to access: Download your data anytime
- Right to delete: Request account deletion
- Right to opt-out: Opt out of research participation`,
      "v1.1": `# Privacy Policy (Updated)

## What Data We Collect
- Email address (required for account)
- Chat messages (to improve the service)
- Optional: Name, date of birth, phone number
- Session metadata (device type, country - anonymized)

## How We Use Your Data
- To provide the coaching service
- To improve our recommendations
- To detect and prevent abuse (if enabled)
- To understand user patterns (anonymized only)

## Data Storage
- Your data is encrypted at rest using AES-256-GCM
- Data is stored securely in PostgreSQL
- We do not share your data with third parties
- Audit logs retained for 6 years per HIPAA requirements

## Your Rights (GDPR/CCPA)
- Right to access: Download your data anytime
- Right to delete: Request account deletion (soft delete preserves audit logs)
- Right to opt-out: Opt out of research participation and marketing emails
- Right to be forgotten: Hard delete after 30-day grace period`,
    },
    RESEARCH_SHARING: {
      "v1.0": `# Research Sharing Consent

By consenting to research sharing, you allow Personal Psychologist to use your anonymized chat history and aggregated insights for research purposes.

## What Gets Shared
- Anonymized conversation patterns (e.g., "user discussed anxiety")
- Aggregated statistics (e.g., "40% of users mention work stress")
- NOT: Personal identifiers, specific details about your life

## How It Helps
- Improves the accuracy of psychology coaching
- Helps researchers understand mental health better
- Contributes to peer-reviewed publications

## Revocation
You can withdraw this consent anytime from your privacy settings.`,
      "v1.1": `# Research Sharing Consent (Updated)

By consenting to research sharing, you allow Personal Psychologist to use your anonymized chat history and aggregated insights for academic and research purposes only.

## What Gets Shared
- Anonymized conversation patterns (e.g., "user discussed anxiety")
- Aggregated statistics (e.g., "40% of users mention work stress")
- De-identified mental health themes
- NOT: Personal identifiers, specific details about your life, email, dates of birth

## How It Helps
- Improves the accuracy of psychology coaching
- Helps researchers understand mental health better
- Contributes to peer-reviewed publications
- May be presented at academic conferences

## Revocation
You can withdraw this consent anytime from your privacy settings. Withdrawal is immediate and retroactive.`,
    },
    MARKETING_EMAILS: {
      "v1.0": `# Marketing Email Consent

By consenting to marketing emails, you agree to receive updates about new features, special offers, and blog posts from Personal Psychologist.

## Frequency
- At most once per week
- You can unsubscribe anytime

## Content
- New feature announcements
- Mental health tips and articles
- Special offers for premium features`,
      "v1.1": `# Marketing Email Consent (Updated)

By consenting to marketing emails, you agree to receive updates about new features, special offers, blog posts, and educational content from Personal Psychologist.

## Frequency
- At most 2-3 times per week
- You can unsubscribe anytime with one click
- Unsubscribe link on every email

## Content
- New feature announcements
- Mental health tips and articles
- Special offers for premium features
- Relevant research and educational content
- Community highlights and user success stories

## Preferences
You can manage email preferences in your account settings.`,
    },
  };

  return (
    policies[consentType]?.[version] || "Policy content not available"
  );
}

/**
 * Generate a summary of user's consent status for profile page
 */
export async function getConsentSummary(userId: string): Promise<Record<string, boolean>> {
  const summary: Record<string, boolean> = {};

  for (const consentType of Object.keys(
    CURRENT_POLICY_VERSIONS
  ) as ConsentTypeValues[]) {
    summary[consentType] = await hasConsent(userId, consentType);
  }

  return summary;
}
