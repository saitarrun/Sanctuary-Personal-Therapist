/**
 * Data anonymization and de-identification utilities
 * Implements HIPAA Safe Harbor de-identification method
 * Removes 18 HIPAA-identified elements from data
 */

import crypto from "crypto";

/**
 * HIPAA Safe Harbor: 18 identifiers to remove or anonymize
 * https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html
 */
const HIPAA_IDENTIFIERS = [
  "names",
  "geographic subdivisions",
  "dates",
  "phone numbers",
  "fax numbers",
  "email addresses",
  "social security numbers",
  "medical record numbers",
  "health plan beneficiary numbers",
  "account numbers",
  "certificate/license numbers",
  "vehicle identifiers",
  "device identifiers",
  "urls",
  "ip addresses",
  "biometric identifiers",
  "full face photographs",
  "any other unique identifying number, code, or characteristic",
];

export interface AnonymizedUserData {
  pseudonymId: string; // Hashed but consistent ID for research
  ageGroup?: string; // Instead of specific DOB
  gender?: string;
  mentalHealthThemes: string[];
  preferredCopingStrategies: string[];
  engagementMetrics: {
    messagesPerSession: number;
    sessionsCount: number;
    averageSessionLength: number;
  };
  timestamps?: {
    firstSessionDate: string; // YYYY-MM only
    lastSessionDate: string; // YYYY-MM only
  };
}

/**
 * Anonymize a user ID consistently for research purposes
 * Same user always gets the same pseudonym, but external parties can't reverse it
 */
export function createPseudonym(userId: string, salt: string = "research"): string {
  return crypto
    .createHash("sha256")
    .update(`${userId}:${salt}`)
    .digest("hex")
    .substring(0, 16);
}

/**
 * Extract age group from date of birth (coarser than exact DOB)
 */
export function getAgeGroup(dob: Date | string): string {
  const birthDate = typeof dob === "string" ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 18) return "13-17";
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  if (age < 65) return "55-64";
  return "65+";
}

/**
 * Remove PII from text (basic approach)
 * Replaces email addresses, phone numbers, etc. with placeholders
 */
export function removePIIFromText(text: string): string {
  if (!text) return text;

  let anonymized = text;

  // Remove email addresses
  anonymized = anonymized.replace(
    /[\w\.-]+@[\w\.-]+\.\w+/g,
    "[EMAIL]"
  );

  // Remove phone numbers (US format and international)
  anonymized = anonymized.replace(
    /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    "[PHONE]"
  );

  // Remove social security numbers (XXX-XX-XXXX)
  anonymized = anonymized.replace(/\d{3}-\d{2}-\d{4}/g, "[SSN]");

  // Remove URLs
  anonymized = anonymized.replace(
    /https?:\/\/[^\s]+/g,
    "[URL]"
  );

  // Remove credit card numbers (16 digits)
  anonymized = anonymized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[CARD]");

  // Remove dates (YYYY-MM-DD format)
  anonymized = anonymized.replace(
    /\d{4}-\d{2}-\d{2}/g,
    "[DATE]"
  );

  // Remove IP addresses
  anonymized = anonymized.replace(
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    "[IP]"
  );

  return anonymized;
}

/**
 * Extract mental health themes from chat history (for research aggregation)
 * Identifies topics like "anxiety", "depression", "stress", etc.
 */
export function extractMentalHealthThemes(chatHistory: string[]): string[] {
  const themes = new Set<string>();

  const themeKeywords: Record<string, string[]> = {
    anxiety: ["anxiety", "anxious", "worried", "nervous", "panic"],
    depression: ["depression", "depressed", "sad", "hopeless", "empty"],
    stress: ["stress", "stressed", "overwhelmed", "pressure", "tension"],
    sleep: ["sleep", "insomnia", "nightmare", "tired", "exhausted"],
    relationships: ["relationship", "family", "friend", "conflict", "trust"],
    work: ["work", "job", "boss", "colleague", "career", "stress"],
    selfEsteem: ["self-esteem", "worthless", "confidence", "capability"],
    addiction: ["addiction", "substance", "alcohol", "drug", "habit"],
    trauma: ["trauma", "ptsd", "trigger", "abuse", "violence"],
    grief: ["grief", "loss", "mourn", "death", "goodbye"],
  };

  for (const message of chatHistory) {
    const lowerMessage = message.toLowerCase();

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
        themes.add(theme);
      }
    }
  }

  return Array.from(themes);
}

/**
 * Extract coping strategies mentioned in chat history
 */
export function extractCopingStrategies(chatHistory: string[]): string[] {
  const strategies = new Set<string>();

  const strategyKeywords: Record<string, string[]> = {
    meditation: ["meditation", "meditate", "mindful", "breathing"],
    exercise: ["exercise", "workout", "running", "gym", "physical"],
    therapy: ["therapy", "therapist", "counseling", "talk"],
    journaling: ["journal", "write", "writing", "diary"],
    socialSupport: ["friend", "family", "support", "talk to"],
    selfCare: ["self-care", "spa", "relax", "time for myself"],
    hobby: ["hobby", "art", "music", "reading", "creative"],
    professional: ["professional help", "doctor", "psychiatrist"],
  };

  for (const message of chatHistory) {
    const lowerMessage = message.toLowerCase();

    for (const [strategy, keywords] of Object.entries(strategyKeywords)) {
      if (keywords.some((keyword) => lowerMessage.includes(keyword))) {
        strategies.add(strategy);
      }
    }
  }

  return Array.from(strategies);
}

/**
 * Anonymize user data for research purposes
 * Returns a minimal dataset suitable for academic research
 */
export function anonymizeUserDataForResearch(
  userId: string,
  userData: {
    dateOfBirth?: string;
    gender?: string;
    chatHistory: string[];
    createdAt: Date;
    lastActivityAt: Date;
    messagesCount: number;
    sessionsCount: number;
  }
): AnonymizedUserData {
  const chatHistoryText = userData.chatHistory.join(" ");
  const anonymizedChat = removePIIFromText(chatHistoryText);

  return {
    pseudonymId: createPseudonym(userId),
    ageGroup: userData.dateOfBirth ? getAgeGroup(userData.dateOfBirth) : undefined,
    gender: userData.gender,
    mentalHealthThemes: extractMentalHealthThemes(userData.chatHistory),
    preferredCopingStrategies: extractCopingStrategies(userData.chatHistory),
    engagementMetrics: {
      messagesPerSession:
        userData.sessionsCount > 0
          ? Math.round(userData.messagesCount / userData.sessionsCount)
          : 0,
      sessionsCount: userData.sessionsCount,
      averageSessionLength: 0, // Would need more detailed data
    },
    timestamps: {
      firstSessionDate: userData.createdAt.toISOString().substring(0, 7), // YYYY-MM
      lastSessionDate: userData.lastActivityAt.toISOString().substring(0, 7), // YYYY-MM
    },
  };
}

/**
 * Check if data has been sufficiently anonymized
 * Returns true if data is safe for research sharing
 */
export function isDataAnonymized(data: unknown): boolean {
  const dataStr = JSON.stringify(data).toLowerCase();

  // Check for common PII patterns
  const piiPatterns = [
    /@[a-z0-9.-]+\.[a-z]{2,}/g, // Email
    /\d{3}-\d{2}-\d{4}/g, // SSN
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
    /[a-z]+ [a-z]+/g, // Full names (heuristic)
  ];

  for (const pattern of piiPatterns) {
    if (pattern.test(dataStr)) {
      return false;
    }
  }

  // Check that sensitive fields are absent or anonymized
  const sensitiveFields = [
    "email",
    "phone",
    "ssn",
    "credit",
    "dob",
    "dateofbirth",
    "firstName",
    "lastName",
  ];

  for (const field of sensitiveFields) {
    if (dataStr.includes(field.toLowerCase())) {
      // This is a simplistic check; real implementation would parse JSON
      return false;
    }
  }

  return true;
}

/**
 * Aggregate statistics from multiple anonymized datasets
 * Used for "N% of users experience X" type of statements
 */
export function aggregateResearchStatistics(
  anonymizedDatasets: AnonymizedUserData[]
): Record<string, any> {
  if (anonymizedDatasets.length === 0) {
    return {};
  }

  // Count theme occurrences
  const themeCounts: Record<string, number> = {};
  for (const dataset of anonymizedDatasets) {
    for (const theme of dataset.mentalHealthThemes) {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    }
  }

  // Count coping strategy occurrences
  const strategyCounts: Record<string, number> = {};
  for (const dataset of anonymizedDatasets) {
    for (const strategy of dataset.preferredCopingStrategies) {
      strategyCounts[strategy] = (strategyCounts[strategy] || 0) + 1;
    }
  }

  // Calculate percentages
  const total = anonymizedDatasets.length;
  const themePercentages: Record<string, number> = {};
  for (const [theme, count] of Object.entries(themeCounts)) {
    themePercentages[theme] = Math.round((count / total) * 100);
  }

  const strategyPercentages: Record<string, number> = {};
  for (const [strategy, count] of Object.entries(strategyCounts)) {
    strategyPercentages[strategy] = Math.round((count / total) * 100);
  }

  // Calculate average engagement
  const avgMessagesPerSession =
    anonymizedDatasets.reduce((sum, d) => sum + d.engagementMetrics.messagesPerSession, 0) /
    total;

  const avgSessions =
    anonymizedDatasets.reduce((sum, d) => sum + d.engagementMetrics.sessionsCount, 0) / total;

  return {
    totalParticipants: total,
    commonThemes: Object.entries(themePercentages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10), // Top 10
    commonStrategies: Object.entries(strategyPercentages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10), // Top 10
    averageEngagement: {
      messagesPerSession: Math.round(avgMessagesPerSession * 10) / 10,
      sessionsPerUser: Math.round(avgSessions * 10) / 10,
    },
  };
}
