/**
 * Privacy Policy Page
 * GDPR/CCPA/HIPAA Compliant
 */

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        <p className="text-gray-600 mb-8">
          Last updated: {new Date().toISOString().split("T")[0]}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
          <p className="text-gray-700 mb-4">
            Personal Psychologist ("we," "our," or "us") is committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information
            in accordance with GDPR, CCPA, HIPAA, and other applicable privacy laws.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Required Information:</h3>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Email address (for account creation and authentication)</li>
            <li>Chat messages and coaching history</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">Optional Information:</h3>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>First and last name</li>
            <li>Date of birth</li>
            <li>Phone number</li>
            <li>Profile bio and avatar</li>
            <li>User preferences (notifications, privacy level, etc.)</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">Automatically Collected:</h3>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Session metadata (device type, country, anonymized IP address)</li>
            <li>Timestamps of account creation and last activity</li>
            <li>Access logs for audit trail and security purposes</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>To provide personalized psychology coaching and recommendations</li>
            <li>To improve our service quality and user experience</li>
            <li>To detect and prevent abuse, fraud, and security threats</li>
            <li>To comply with legal obligations (if required by law)</li>
            <li>To communicate with you about updates to our service</li>
            <li>For research purposes (only if you opt in)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Data Security & Encryption</h2>
          <p className="text-gray-700 mb-4">
            Your data is protected with industry-leading security measures:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>
              <strong>Encryption at rest:</strong> Sensitive personal information (phone, date of birth) is encrypted using AES-256-GCM
            </li>
            <li>
              <strong>Encryption in transit:</strong> All data is transmitted over TLS 1.3 connections
            </li>
            <li>
              <strong>Database security:</strong> PostgreSQL with encrypted connections
            </li>
            <li>
              <strong>Access controls:</strong> Authentication required for all data access
            </li>
            <li>
              <strong>Audit logging:</strong> All data access and modifications are logged for compliance
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data Retention</h2>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>
              <strong>Chat history:</strong> Retained as long as your account is active; deleted upon request
            </li>
            <li>
              <strong>Personal information:</strong> Retained for account management; deleted upon account deletion
            </li>
            <li>
              <strong>Audit logs:</strong> Retained for 6 years per HIPAA requirements, even after account deletion
            </li>
            <li>
              <strong>Consent records:</strong> Maintained indefinitely for legal compliance
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Your Privacy Rights (GDPR/CCPA)</h2>
          <h3 className="text-xl font-semibold text-gray-800 mb-3">Right to Access</h3>
          <p className="text-gray-700 mb-4">
            You can download all your personal data in JSON format at any time from your privacy settings.
          </p>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">Right to Delete</h3>
          <p className="text-gray-700 mb-4">
            You can request account deletion. We provide two options:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>
              <strong>Soft delete:</strong> Account is deactivated immediately with a 30-day recovery period
            </li>
            <li>
              <strong>Hard delete:</strong> Permanent deletion after the 30-day recovery period (audit logs retained per HIPAA)
            </li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">Right to Opt-Out</h3>
          <p className="text-gray-700 mb-4">
            You can opt out of:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Research data sharing (anonymized data will no longer be used for studies)</li>
            <li>Marketing emails (any time, with one click)</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">Right to Data Portability</h3>
          <p className="text-gray-700 mb-4">
            Your data is available in JSON format for export to other services.
          </p>

          <h3 className="text-xl font-semibold text-gray-800 mb-3">Right to Rectification</h3>
          <p className="text-gray-700 mb-4">
            You can update your personal information at any time in your profile settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Research & Data Sharing</h2>
          <p className="text-gray-700 mb-4">
            If you opt in to research sharing, your anonymized data may be used for:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Academic research on psychology and mental health</li>
            <li>Peer-reviewed publications</li>
            <li>Conference presentations</li>
            <li>Improving AI coaching algorithms</li>
          </ul>

          <p className="text-gray-700 mb-4">
            <strong>What is NOT shared:</strong>
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Your name, email, or any direct identifiers</li>
            <li>Specific personal details about your life</li>
            <li>Exact chat messages (only aggregated themes)</li>
            <li>Your data with commercial third parties</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">8. HIPAA Considerations</h2>
          <p className="text-gray-700 mb-4">
            <strong>Important:</strong> Personal Psychologist is NOT a covered entity under HIPAA and does not provide
            medical services. However, we implement HIPAA-compliant practices:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Comprehensive audit logging of all data access</li>
            <li>Encryption of sensitive personal information</li>
            <li>Breach notification procedures</li>
            <li>Data retention and deletion policies</li>
            <li>Access controls and authentication</li>
          </ul>

          <p className="text-gray-700 mt-4">
            If you have mental health concerns requiring professional care, please consult a licensed therapist or psychiatrist.
            In case of crisis, please call the 988 Suicide & Crisis Lifeline (US) or your local emergency services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Cookies & Tracking</h2>
          <p className="text-gray-700 mb-4">
            We use minimal tracking:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Session cookies for authentication (necessary for functionality)</li>
            <li>Analytics cookies (only if you consent) to improve user experience</li>
          </ul>

          <p className="text-gray-700 mt-4">
            You can disable cookies in your browser settings. This may limit some functionality.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Third-Party Services</h2>
          <p className="text-gray-700 mb-4">
            We use the following third-party services:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>
              <strong>Sentry:</strong> Error tracking and monitoring (privacy-first, only error data)
            </li>
            <li>
              <strong>Vercel:</strong> Hosting and deployment infrastructure
            </li>
            <li>
              <strong>PostgreSQL/Neon:</strong> Database hosting (encrypted connections)
            </li>
          </ul>

          <p className="text-gray-700 mt-4">
            We do not share your personal data with any other third parties without your explicit consent.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">11. International Data Transfers</h2>
          <p className="text-gray-700 mb-4">
            If you are in the EU, your data is protected under GDPR. We use Standard Contractual Clauses
            for any international data transfers.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Policy Updates</h2>
          <p className="text-gray-700 mb-4">
            We may update this privacy policy occasionally. Material changes will be announced to users,
            and we will request re-consent if required. Your continued use of the service indicates acceptance.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Contact Us</h2>
          <p className="text-gray-700 mb-4">
            If you have questions or concerns about this privacy policy, please contact us at:
          </p>
          <p className="text-gray-700">
            <strong>Email:</strong> privacy@personal-psychologist.app
          </p>
          <p className="text-gray-700">
            <strong>Address:</strong> Available upon request
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">14. CCPA Disclosures (California Residents)</h2>
          <p className="text-gray-700 mb-4">
            Under the California Consumer Privacy Act, you have the right to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Know what personal data we collect, use, share, and sell</li>
            <li>Delete personal data (with certain exceptions)</li>
            <li>Opt-out of the "sale" or "sharing" of personal data</li>
            <li>Non-discrimination for exercising your rights</li>
          </ul>

          <p className="text-gray-700 mt-4">
            Personal Psychologist does not "sell" personal data. We may "share" anonymized data for research purposes
            (as described above), which you can opt out of.
          </p>
        </section>

        <footer className="mt-12 pt-8 border-t border-gray-300">
          <p className="text-sm text-gray-600">
            This privacy policy is provided for informational purposes and does not constitute legal advice.
            Please consult with a legal professional if you have specific privacy concerns.
          </p>
        </footer>
      </div>
    </div>
  );
}
