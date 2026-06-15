/**
 * Terms of Service Page
 */

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        <p className="text-gray-600 mb-8">
          Last updated: {new Date().toISOString().split("T")[0]}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-700 mb-4">
            By accessing and using Personal Psychologist, you accept and agree to be bound by the terms
            and provision of this agreement. If you do not agree to abide by the above, please do not
            use this service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Use License</h2>
          <p className="text-gray-700 mb-4">
            Permission is granted to temporarily download one copy of the materials (information or software)
            on Personal Psychologist for personal, non-commercial transitory viewing only. This is the grant of
            a license, not a transfer of title, and under this license you may not:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Modifying or copying the materials;</li>
            <li>Using the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
            <li>Attempting to decompile or reverse engineer any software contained on the Site;</li>
            <li>Removing any copyright or other proprietary notations from the materials;</li>
            <li>Transferring the materials to another person or "mirroring" the materials on any other server;</li>
            <li>Violating the intellectual property rights of any person;</li>
            <li>Harassing, threatening, abusing, or otherwise violating the legal rights of others;</li>
            <li>Engaging in any conduct that restricts or inhibits anyone's use or enjoyment of the website.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Disclaimer</h2>
          <p className="text-gray-700 mb-4">
            <strong>NOT MEDICAL OR MENTAL HEALTH TREATMENT:</strong>
          </p>
          <p className="text-gray-700 mb-4">
            Personal Psychologist is provided for educational and informational purposes only. It is NOT:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>A replacement for professional mental health treatment</li>
            <li>Medical advice or mental health counseling</li>
            <li>Provided by licensed therapists or mental health professionals</li>
            <li>A tool for crisis intervention</li>
          </ul>

          <p className="text-gray-700 mb-4">
            <strong>If you are experiencing a mental health crisis:</strong>
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Call 988 (Suicide & Crisis Lifeline) in the US</li>
            <li>Text "HELLO" to 741741 (Crisis Text Line)</li>
            <li>Call 911 or visit your nearest emergency room</li>
            <li>Contact a mental health professional immediately</li>
          </ul>

          <p className="text-gray-700 mb-4">
            The materials on Personal Psychologist are provided on an "as-is" basis without warranties of
            any kind, either express or implied. We disclaim all warranties, express or implied, including
            but not limited to implied warranties of merchantability and fitness for a particular purpose.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Limitation of Liability</h2>
          <p className="text-gray-700 mb-4">
            In no event shall Personal Psychologist or its suppliers be liable for any damages (including,
            without limitation, damages for loss of data or profit, or due to business interruption) arising
            out of the use or inability to use the materials on the site, even if we have been notified
            orally or in writing of the possibility of such damage.
          </p>

          <p className="text-gray-700 mb-4">
            We are not responsible for:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Decisions or actions taken based on advice from the AI coach</li>
            <li>Any adverse mental health outcomes</li>
            <li>Data breaches or unauthorized access (though we implement best practices)</li>
            <li>Temporary service unavailability or data loss</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Accuracy of Materials</h2>
          <p className="text-gray-700 mb-4">
            The materials appearing on Personal Psychologist could include technical, typographical, or
            photographic errors. We do not warrant that any of the materials are accurate, complete, or current.
            We may make changes to the materials contained on the site at any time without notice.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Materials and Content</h2>
          <p className="text-gray-700 mb-4">
            Unless otherwise stated, we own the intellectual property rights for all materials on the site.
            All intellectual property rights are reserved. You may access this for personal use subject to
            restrictions set in these terms and conditions.

            You must not:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Republish materials from the site</li>
            <li>Sell, rent, or sub-license material from the site</li>
            <li>Reproduce, duplicate, or copy materials for commercial purposes</li>
            <li>Redistribute content from Personal Psychologist unless content is specifically made for redistribution</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">7. User Responsibilities</h2>
          <p className="text-gray-700 mb-4">
            As a user of Personal Psychologist, you are responsible for:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Maintaining the confidentiality of your account information and password</li>
            <li>Accepting responsibility for all activities that occur under your account</li>
            <li>Ensuring that information you provide is truthful and accurate</li>
            <li>Not using the service for illegal, harmful, or abusive purposes</li>
            <li>Complying with all applicable laws and regulations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Acceptable Use Policy</h2>
          <p className="text-gray-700 mb-4">
            You agree not to use Personal Psychologist to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4">
            <li>Harass, abuse, or threaten others</li>
            <li>Engage in discrimination based on protected characteristics</li>
            <li>Post content that is sexually explicit or graphic</li>
            <li>Spam or send unsolicited messages</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Probe, scan, or test vulnerabilities in the system</li>
            <li>Engage in any illegal activity</li>
            <li>Impersonate another user or person</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Account Termination</h2>
          <p className="text-gray-700 mb-4">
            We may terminate or suspend your account immediately, without prior notice or liability,
            for any reason whatsoever, including if you breach the Terms. Upon termination, your right
            to use the service will immediately cease. If you wish to terminate your account, you may
            request account deletion from your privacy settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Modifications to Terms</h2>
          <p className="text-gray-700 mb-4">
            We may revise these terms of service at any time without notice. By using the site, you are
            agreeing to be bound by the then current version of these terms of service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Governing Law</h2>
          <p className="text-gray-700 mb-4">
            These terms and conditions are governed by and construed in accordance with the laws of [Your Jurisdiction],
            and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Contact Information</h2>
          <p className="text-gray-700 mb-4">
            If you have any questions about these Terms, please contact us at:
          </p>
          <p className="text-gray-700">
            <strong>Email:</strong> support@personal-psychologist.app
          </p>
        </section>

        <footer className="mt-12 pt-8 border-t border-gray-300">
          <p className="text-sm text-gray-600">
            These terms of service are provided for informational purposes and do not constitute legal advice.
            Please consult with a legal professional if you have specific concerns.
          </p>
        </footer>
      </div>
    </div>
  );
}
