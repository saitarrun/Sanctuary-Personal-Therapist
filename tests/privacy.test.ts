/**
 * Tests for Phase 6: Privacy utilities (encryption, anonymization, audit logging)
 * Run with: npm test -- privacy.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  encrypt,
  decrypt,
  hashValue,
  anonymizeIP,
  generateEncryptionKey,
  testEncryption,
} from "@/lib/privacy/encryption";
import {
  createPseudonym,
  getAgeGroup,
  removePIIFromText,
  extractMentalHealthThemes,
  extractCopingStrategies,
  anonymizeUserDataForResearch,
  isDataAnonymized,
  aggregateResearchStatistics,
} from "@/lib/privacy/anonymization";

describe("Encryption", () => {
  it("should encrypt and decrypt data", () => {
    const testData = "sensitive-phone-number";
    const encrypted = encrypt(testData);
    expect(encrypted).not.toBe(testData);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(testData);
  });

  it("should handle empty strings", () => {
    const encrypted = encrypt("");
    expect(encrypted).toBe("");

    const decrypted = decrypt("");
    expect(decrypted).toBe("");
  });

  it("should produce different ciphertexts for same plaintext", () => {
    const data = "test-data";
    const encrypted1 = encrypt(data);
    const encrypted2 = encrypt(data);

    // Should be different due to random IV
    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to same value
    expect(decrypt(encrypted1)).toBe(data);
    expect(decrypt(encrypted2)).toBe(data);
  });

  it("should handle special characters", () => {
    const testData = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(testData);
  });

  it("should test encryption with testEncryption()", () => {
    expect(testEncryption()).toBe(true);
  });
});

describe("Hash Value", () => {
  it("should hash sensitive data", () => {
    const value = "555-1234";
    const hash = hashValue(value);

    // Should be consistent
    expect(hash).toBe(hashValue(value));

    // Should not be reversible
    expect(hash).not.toBe(value);

    // Should be a valid SHA256 hex string
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should handle empty strings", () => {
    expect(hashValue("")).toBe("");
  });
});

describe("IP Anonymization", () => {
  it("should anonymize IPv4 addresses", () => {
    expect(anonymizeIP("192.168.1.42")).toBe("192.168.1.0");
    expect(anonymizeIP("10.0.0.100")).toBe("10.0.0.0");
    expect(anonymizeIP("8.8.8.8")).toBe("8.8.8.0");
  });

  it("should handle IPv6 addresses", () => {
    const result = anonymizeIP("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    // Should zero the last 64 bits
    expect(result).toContain("2001:0db8");
    expect(result).toContain(":0");
  });

  it("should handle empty IP", () => {
    expect(anonymizeIP("")).toBe("");
  });
});

describe("Encryption Key Generation", () => {
  it("should generate a valid base64-encoded 32-byte key", () => {
    const key = generateEncryptionKey();

    // Should be base64-encoded
    expect(key).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);

    // When decoded, should be 32 bytes (256 bits)
    const decoded = Buffer.from(key, "base64");
    expect(decoded.length).toBe(32);
  });
});

describe("Anonymization - Pseudonym Generation", () => {
  it("should create consistent pseudonyms for same user", () => {
    const userId = "user-12345";
    const pseudo1 = createPseudonym(userId);
    const pseudo2 = createPseudonym(userId);

    expect(pseudo1).toBe(pseudo2);
  });

  it("should create different pseudonyms for different users", () => {
    const pseudo1 = createPseudonym("user-1");
    const pseudo2 = createPseudonym("user-2");

    expect(pseudo1).not.toBe(pseudo2);
  });

  it("should create pseudonyms of consistent length", () => {
    const pseudo = createPseudonym("user-test");
    expect(pseudo.length).toBe(16);
  });
});

describe("Age Group Calculation", () => {
  it("should calculate correct age groups", () => {
    // Create dates for testing
    const now = new Date();

    // 16 years old
    const age16 = new Date(now.getFullYear() - 16, now.getMonth(), now.getDate());
    expect(getAgeGroup(age16)).toBe("13-17");

    // 22 years old
    const age22 = new Date(now.getFullYear() - 22, now.getMonth(), now.getDate());
    expect(getAgeGroup(age22)).toBe("18-24");

    // 30 years old
    const age30 = new Date(now.getFullYear() - 30, now.getMonth(), now.getDate());
    expect(getAgeGroup(age30)).toBe("25-34");

    // 70 years old
    const age70 = new Date(now.getFullYear() - 70, now.getMonth(), now.getDate());
    expect(getAgeGroup(age70)).toBe("65+");
  });

  it("should handle string dates", () => {
    const result = getAgeGroup("1990-01-01");
    expect(result).toMatch(/^\d+-\d+$|^\d+\+$/); // Valid age group format
  });
});

describe("PII Removal from Text", () => {
  it("should remove email addresses", () => {
    const text = "Contact me at john@example.com for more info";
    const result = removePIIFromText(text);
    expect(result).not.toContain("john@example.com");
    expect(result).toContain("[EMAIL]");
  });

  it("should remove phone numbers", () => {
    const text = "Call me at (555) 123-4567";
    const result = removePIIFromText(text);
    expect(result).not.toContain("555");
    expect(result).toContain("[PHONE]");
  });

  it("should remove URLs", () => {
    const text = "Visit https://example.com for details";
    const result = removePIIFromText(text);
    expect(result).not.toContain("https://example.com");
    expect(result).toContain("[URL]");
  });

  it("should remove dates", () => {
    const text = "Appointment on 2024-03-15 at noon";
    const result = removePIIFromText(text);
    expect(result).not.toContain("2024-03-15");
    expect(result).toContain("[DATE]");
  });

  it("should remove SSN", () => {
    const text = "SSN: 123-45-6789";
    const result = removePIIFromText(text);
    expect(result).not.toContain("123-45-6789");
    expect(result).toContain("[SSN]");
  });

  it("should handle text without PII", () => {
    const text = "This is a normal sentence";
    expect(removePIIFromText(text)).toBe(text);
  });
});

describe("Mental Health Theme Extraction", () => {
  it("should extract anxiety theme", () => {
    const chat = [
      "I feel really anxious about my presentation",
      "I'm worried all the time",
    ];
    const themes = extractMentalHealthThemes(chat);
    expect(themes).toContain("anxiety");
  });

  it("should extract depression theme", () => {
    const chat = ["I feel so depressed lately", "Everything seems hopeless"];
    const themes = extractMentalHealthThemes(chat);
    expect(themes).toContain("depression");
  });

  it("should extract multiple themes", () => {
    const chat = [
      "I'm anxious and depressed",
      "Work stress is overwhelming",
    ];
    const themes = extractMentalHealthThemes(chat);
    expect(themes.length).toBeGreaterThanOrEqual(2);
    expect(themes).toContain("anxiety");
    expect(themes).toContain("stress");
  });

  it("should handle empty chat", () => {
    const themes = extractMentalHealthThemes([]);
    expect(themes).toEqual([]);
  });
});

describe("Coping Strategy Extraction", () => {
  it("should extract meditation strategy", () => {
    const chat = [
      "I started meditating daily",
      "Mindful breathing helps",
    ];
    const strategies = extractCopingStrategies(chat);
    expect(strategies).toContain("meditation");
  });

  it("should extract exercise strategy", () => {
    const chat = ["Running at the gym helps me", "Exercise is therapeutic"];
    const strategies = extractCopingStrategies(chat);
    expect(strategies).toContain("exercise");
  });

  it("should extract multiple strategies", () => {
    const chat = [
      "I meditate and journal daily",
      "Exercise helps too",
    ];
    const strategies = extractCopingStrategies(chat);
    expect(strategies.length).toBeGreaterThanOrEqual(2);
  });
});

describe("User Data Anonymization", () => {
  it("should anonymize user data for research", () => {
    const userData = {
      dateOfBirth: new Date("1990-01-01"),
      gender: "other",
      chatHistory: [
        "I feel anxious about work",
        "Exercise helps me cope",
      ],
      createdAt: new Date("2023-01-01"),
      lastActivityAt: new Date("2024-01-01"),
      messagesCount: 50,
      sessionsCount: 10,
    };

    const anonymized = anonymizeUserDataForResearch("user-123", userData);

    expect(anonymized.pseudonymId).toBeDefined();
    expect(anonymized.pseudonymId).toHaveLength(16);
    expect(anonymized.ageGroup).toBe("35-44");
    expect(anonymized.mentalHealthThemes).toContain("anxiety");
    expect(anonymized.preferredCopingStrategies).toContain("exercise");
    expect(anonymized.engagementMetrics.sessionsCount).toBe(10);
  });

  it("should not expose PII in anonymized data", () => {
    const userData = {
      dateOfBirth: new Date("1990-01-01"),
      gender: "other",
      chatHistory: ["My email is test@example.com and my phone is 555-1234"],
      createdAt: new Date(),
      lastActivityAt: new Date(),
      messagesCount: 1,
      sessionsCount: 1,
    };

    const anonymized = anonymizeUserDataForResearch("user-456", userData);
    const stringified = JSON.stringify(anonymized);

    expect(stringified).not.toContain("test@example.com");
    expect(stringified).not.toContain("555-1234");
  });
});

describe("Data Anonymization Verification", () => {
  it("should identify properly anonymized data", () => {
    const anonymizedData = {
      pseudonymId: "abc123def456ghi",
      ageGroup: "25-34",
      mentalHealthThemes: ["anxiety"],
      engagementMetrics: { sessagesPerSession: 5, sessionsCount: 10 },
    };

    expect(isDataAnonymized(anonymizedData)).toBe(true);
  });

  it("should detect non-anonymized data with email", () => {
    const nonAnonymized = {
      email: "test@example.com",
      pseudonymId: "abc123",
    };

    expect(isDataAnonymized(nonAnonymized)).toBe(false);
  });
});

describe("Research Statistics Aggregation", () => {
  it("should aggregate statistics from multiple users", () => {
    const datasets = [
      {
        pseudonymId: "user1",
        ageGroup: "25-34",
        mentalHealthThemes: ["anxiety", "stress"],
        preferredCopingStrategies: ["exercise", "meditation"],
        engagementMetrics: {
          messagesPerSession: 10,
          sessionsCount: 5,
          averageSessionLength: 0,
        },
      },
      {
        pseudonymId: "user2",
        ageGroup: "35-44",
        mentalHealthThemes: ["stress"],
        preferredCopingStrategies: ["meditation"],
        engagementMetrics: {
          messagesPerSession: 8,
          sessionsCount: 3,
          averageSessionLength: 0,
        },
      },
    ];

    const stats = aggregateResearchStatistics(datasets);

    expect(stats.totalParticipants).toBe(2);
    expect(stats.commonThemes).toBeDefined();
    expect(stats.commonStrategies).toBeDefined();
    expect(stats.averageEngagement).toBeDefined();
  });

  it("should handle empty datasets", () => {
    const stats = aggregateResearchStatistics([]);
    expect(stats).toEqual({});
  });
});
