import type { Metadata } from "next";
import { LegalShell } from "@/components/public/LegalShell";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: `How ${siteConfig.name} collects, uses, and protects your account, viewing, and payment information.`,
  path: "/legal/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="November 19, 2026">
      <h2>Information we collect</h2>
      <p>
        We collect the email and name you provide at signup, hashed passwords, subscription and order
        records, coin balances, watch progress, My List saves, and device/browser data needed to keep you
        signed in and improve the player. If you pay with Stripe, card details are processed by Stripe —
        we do not store full card numbers on our servers.
      </p>
      <h2>How we use it</h2>
      <ul>
        <li>To operate your account, recommendations, and resume-watching.</li>
        <li>To process subscriptions, coin packs, refunds, and customer support.</li>
        <li>To keep the service secure, prevent fraud, and comply with law.</li>
        <li>To send transactional email (receipts, password and plan notices). Marketing email is optional.</li>
      </ul>
      <h2>Sharing</h2>
      <p>
        We share data with payment processors (such as Stripe), hosting providers, and only when required
        by law. We do not sell your personal information.
      </p>
      <h2>Retention and security</h2>
      <p>
        We keep account and order records for as long as your account is open and as needed for tax and
        legal purposes. Passwords are hashed. Access to admin tools is restricted to authorized staff.
      </p>
      <h2>Your choices</h2>
      <p>
        You may request access, correction, or deletion of your account data by emailing{" "}
        {siteConfig.supportEmail}. You can close your account, cancel VIP, and clear list/history from
        your account pages where those controls are available.
      </p>
      <h2>International users</h2>
      <p>
        {siteConfig.name} may process data in the country where our servers are hosted. If you use the
        service from another region, you consent to that transfer, subject to applicable law (including
        GDPR/CCPA rights where they apply).
      </p>
    </LegalShell>
  );
}
