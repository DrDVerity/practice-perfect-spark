import { useEffect, type ReactNode } from "react";
import { Header } from "@/components/archer/Header";
import { Footer } from "@/components/archer/Footer";
import { SubPageHero } from "@/components/archer/SubPageHero";

function LegalShell({
  title,
  eyebrow,
  heroTitle,
  intro,
  updated,
  children,
}: {
  title: string;
  eyebrow: string;
  heroTitle: ReactNode;
  intro: string;
  updated: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return (
    <div className="archer min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header />
      <main>
        <SubPageHero eyebrow={eyebrow} title={heroTitle} intro={intro} />
        <section className="px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <p className="mb-8 text-sm text-muted-foreground">Last updated: {updated}</p>
            <div className="prose prose-slate max-w-none space-y-6 text-foreground [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-muted-foreground [&_li]:mt-1 [&_a]:text-primary [&_a]:underline">
              <p className="text-sm italic">
                This page is maintained by Promethian, the Perfect Practice Partner to answer
                common questions about Archer. It is not a certification or legal opinion. For
                questions, contact{" "}
                <a href="mailto:hello@digitaldentalfusion.com">hello@digitaldentalfusion.com</a>.
              </p>
              {children}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy, Archer"
      eyebrow="Legal"
      updated="June 25, 2026"
      heroTitle={<>Privacy <span className="text-gradient">Policy.</span></>}
      intro="How Archer collects, uses, and protects information when you use our marketing platform."
    >
      <h2>1. Who we are</h2>
      <p>
        Archer is an agentic marketing platform operated by Promethian, the Perfect Practice
        Partner ("Promethian," "we," "us"). This Privacy Policy explains what information we
        handle when practices and their authorized users access Archer.
      </p>

      <h2>2. Information we collect</h2>
      <ul>
        <li>
          <strong>Account information</strong> you provide when signing up, name, work email,
          practice name, role, and authentication identifiers from sign-in providers (e.g.,
          Google).
        </li>
        <li>
          <strong>Practice and campaign content</strong> you upload or generate, website URLs,
          knowledge-base documents, brand assets, campaign briefs, posts, images, and reports.
        </li>
        <li>
          <strong>Connected channel data</strong> required to publish on your behalf, social
          account identifiers, access tokens, and post metadata for connected platforms.
        </li>
        <li>
          <strong>Usage and device data</strong>, log records, IP address, browser, pages
          viewed, and feature interactions, used to operate and improve the product.
        </li>
      </ul>
      <p>
        Archer is not designed to collect Protected Health Information (PHI). Do not upload
        patient records, treatment data, or other PHI into the platform. See the HIPAA page
        for details.
      </p>

      <h2>3. How we use information</h2>
      <ul>
        <li>To provide, secure, and improve the Archer platform.</li>
        <li>
          To generate marketing strategies, posts, images, landing pages, and reports on your
          behalf using AI models.
        </li>
        <li>To publish content to channels you have explicitly connected.</li>
        <li>To communicate service updates, security notices, and support responses.</li>
        <li>To meet legal, accounting, and fraud-prevention obligations.</li>
      </ul>

      <h2>4. Sharing and subprocessors</h2>
      <p>
        We share information only with vendors that help us run the service, under written
        agreements that restrict their use of your data. Current categories include cloud
        infrastructure and database hosting, AI model providers used to generate content,
        social publishing providers used to schedule and publish posts, and email and analytics
        providers used for product communications. A current list is available on request.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We retain account, campaign, and content data for the life of your account and for a
        reasonable period afterward to meet legal, audit, and recovery obligations. You may
        request deletion of your account and associated content at any time.
      </p>

      <h2>6. Your choices</h2>
      <ul>
        <li>Access, correct, or export your account and content data.</li>
        <li>Disconnect any connected channel from inside the app at any time.</li>
        <li>Request account deletion by emailing the address below.</li>
      </ul>

      <h2>7. Security</h2>
      <p>
        Archer is hosted on enterprise cloud infrastructure with encryption in transit,
        encryption at rest for stored data, role-based access controls, and audit logging.
        No system is perfectly secure; we encourage strong passwords and use of single sign-on.
      </p>

      <h2>8. Children</h2>
      <p>Archer is intended for business users and is not directed to children under 16.</p>

      <h2>9. Changes</h2>
      <p>
        We may update this Policy from time to time. Material changes will be announced in the
        product or by email to account owners.
      </p>

      <h2>10. Contact</h2>
      <p>
        Privacy questions:{" "}
        <a href="mailto:hello@digitaldentalfusion.com">hello@digitaldentalfusion.com</a>.
      </p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service, Archer"
      eyebrow="Legal"
      updated="June 25, 2026"
      heroTitle={<>Terms of <span className="text-gradient">Service.</span></>}
      intro="The agreement between your practice and Promethian for using Archer."
    >
      <h2>1. Agreement</h2>
      <p>
        These Terms of Service ("Terms") govern your access to and use of Archer, operated by
        Promethian, the Perfect Practice Partner. By creating an account or using the
        service, you agree to these Terms on behalf of yourself and your practice.
      </p>

      <h2>2. Accounts and access</h2>
      <ul>
        <li>You must be at least 18 years old and authorized to bind your practice.</li>
        <li>You are responsible for activity under your account and for keeping credentials secure.</li>
        <li>You will not share accounts or attempt to access another customer's data.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <ul>
        <li>No unlawful, deceptive, discriminatory, or harassing content.</li>
        <li>No upload of Protected Health Information (PHI) or other regulated sensitive data.</li>
        <li>No reverse engineering, scraping at scale, or attempts to bypass security controls.</li>
        <li>You are responsible for the accuracy and compliance of content you approve for publication.</li>
      </ul>

      <h2>4. Your content</h2>
      <p>
        You retain all rights to the content you upload or that Archer generates for your
        practice. You grant Promethian a limited license to host, process, and display that
        content solely to operate the service, including transmitting it to AI providers and
        connected channels you have authorized.
      </p>

      <h2>5. AI-generated output</h2>
      <p>
        Archer uses AI models to generate marketing strategies, copy, images, and reports.
        Output may be inaccurate, incomplete, or unsuitable; you are responsible for reviewing
        and approving content before publication. AI-generated material may not be unique to
        you and may be similar to output produced for other users.
      </p>

      <h2>6. Third-party services</h2>
      <p>
        Connecting third-party channels (e.g., social networks, review platforms) is governed
        by their own terms. We are not responsible for changes, outages, or policy actions by
        those providers.
      </p>

      <h2>7. Fees and billing</h2>
      <p>
        Paid plans are billed in advance per the order form or in-app pricing. Fees are
        non-refundable except where required by law. You authorize us to charge your payment
        method on a recurring basis until cancellation.
      </p>

      <h2>8. Suspension and termination</h2>
      <p>
        We may suspend or terminate access for non-payment, violation of these Terms, or risk
        to the platform or other customers. You may terminate at any time from your account.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        Archer is provided "as is" and "as available." Promethian disclaims all warranties to
        the maximum extent permitted by law, including merchantability, fitness for a
        particular purpose, and non-infringement. Marketing results are not guaranteed.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Promethian's aggregate liability for any claim
        arising out of or relating to the service is limited to the fees you paid to us in the
        12 months preceding the claim. We are not liable for indirect, incidental,
        consequential, or lost-profits damages.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You will defend and indemnify Promethian against claims arising from content you
        upload or approve for publication and from your violation of these Terms or applicable
        law.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, USA, without regard to
        its conflict-of-laws principles. Venue lies exclusively in the state and federal
        courts located in Delaware.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update these Terms; continued use after notice constitutes acceptance. Material
        changes will be announced in the product or by email to account owners.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href="mailto:hello@digitaldentalfusion.com">hello@digitaldentalfusion.com</a>.
      </p>
    </LegalShell>
  );
}

export function HipaaPage() {
  return (
    <LegalShell
      title="HIPAA Statement, Archer"
      eyebrow="Legal"
      updated="June 25, 2026"
      heroTitle={<>HIPAA <span className="text-gradient">Statement.</span></>}
      intro="How Archer is designed to stay outside the flow of Protected Health Information."
    >
      <h2>1. Our position</h2>
      <p>
        Archer is a marketing platform. It is designed so that Protected Health Information
        (PHI), as defined by the Health Insurance Portability and Accountability Act of 1996
        (HIPAA), is not required to operate any feature. Practices should not upload, paste,
        or otherwise transmit PHI into Archer.
      </p>

      <h2>2. What this means in practice</h2>
      <ul>
        <li>Campaigns, posts, images, and landing pages are written for general audiences, never about an identifiable patient.</li>
        <li>Knowledge-base documents should describe services, policies, and practice marketing, not patient records or treatment data.</li>
        <li>Review responses are templated and reviewed by your team before publication; do not include patient-specific clinical details.</li>
        <li>Connected social and review channels are not configured to ingest PHI from your practice management system.</li>
      </ul>

      <h2>3. Business Associate Agreements</h2>
      <p>
        Because Archer is not designed to create, receive, maintain, or transmit PHI on behalf
        of a covered entity, Promethian does not, by default, enter into Business Associate
        Agreements (BAAs). If your use case requires a BAA, contact us to discuss whether your
        intended use is appropriate for the platform.
      </p>

      <h2>4. Your responsibilities</h2>
      <ul>
        <li>Train staff with Archer access to avoid uploading PHI.</li>
        <li>Review AI-generated drafts before they are published to confirm no patient-identifying information has been introduced.</li>
        <li>Use unique accounts for each team member and revoke access promptly when roles change.</li>
        <li>Configure connected channels (social, reviews, scheduling) within your own HIPAA program.</li>
      </ul>

      <h2>5. Security controls</h2>
      <p>
        Archer is hosted on enterprise cloud infrastructure with TLS in transit, encryption at
        rest for stored data, role-based access controls, multi-tenant isolation enforced at
        the database layer, audit logging, and least-privilege administrative access.
      </p>

      <h2>6. Incident response</h2>
      <p>
        If we discover an incident that may involve customer data, we will notify affected
        account owners without undue delay and provide the information needed to evaluate the
        impact.
      </p>

      <h2>7. Contact</h2>
      <p>
        Security and compliance questions:{" "}
        <a href="mailto:hello@digitaldentalfusion.com">hello@digitaldentalfusion.com</a>.
      </p>
    </LegalShell>
  );
}
