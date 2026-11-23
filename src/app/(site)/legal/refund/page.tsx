import type { Metadata } from "next";
import { LegalShell } from "@/components/public/LegalShell";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Refund Policy",
  description: `Refund and cancellation rules for ${siteConfig.name} VIP plans and coin packs.`,
  path: "/legal/refund",
});

export default function RefundPage() {
  return (
    <LegalShell title="Refund Policy" updated="November 19, 2026">
      <h2>Cancel anytime</h2>
      <p>
        You can cancel a VIP plan at any time from your account. Cancellation takes effect at the end of
        the current billing period. You will not be charged again, and you keep VIP access until that
        date. This is the standard way to stop a subscription — it is not the same as a refund.
      </p>
      <h2>When we refund</h2>
      <p>
        If you were charged in error, billed twice, or could not access paid episodes because of a
        confirmed platform outage lasting more than 24 hours, contact {siteConfig.supportEmail} within
        14 days of the charge. We will review order records and may refund the affected period or credit
        coins, at our discretion and as required by law.
      </p>
      <h2>What is generally not refundable</h2>
      <ul>
        <li>VIP time you already used to watch paywalled episodes.</li>
        <li>Coins that have already been spent to unlock episodes.</li>
        <li>Change-of-mind requests after a full series has been unlocked and watched.</li>
      </ul>
      <h2>How to request a refund</h2>
      <p>
        Email {siteConfig.supportEmail} with your account email, approximate charge time, and a short
        description of the issue. We aim to respond within two business days. Chargebacks should be a
        last resort; contacting us first helps us resolve the issue faster.
      </p>
    </LegalShell>
  );
}
