import type { Metadata } from "next";
import { LegalShell } from "@/components/public/LegalShell";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Use",
  description: `Terms of Use for ${siteConfig.name}, including accounts, subscriptions, and acceptable use of our short drama service.`,
  path: "/legal/terms",
});

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Use" updated="November 19, 2026">
      <h2>1. The service</h2>
      <p>
        {siteConfig.name} is a streaming service for original English short dramas. We grant you a limited,
        personal, non-transferable license to stream content for your own private enjoyment. You may not
        copy, re-upload, scrape, or publicly perform our videos or artwork.
      </p>
      <h2>2. Accounts</h2>
      <p>
        You must provide accurate information and keep your password confidential. You are responsible for
        activity on your account. We may suspend or close accounts that violate these terms, including
        shared-password abuse or attempts to bypass the paywall.
      </p>
      <h2>3. Subscriptions, coins, and billing</h2>
      <p>
        VIP plans renew at the end of the chosen period unless you cancel first. Canceling stops the next
        renewal; you keep access until the period you already paid for ends. Coins are a digital wallet
        used to unlock individual episodes. Coins have no cash value, are non-transferable, and are not
        redeemable except where required by law.
      </p>
      <h2>4. Free episodes and paywalled content</h2>
      <p>
        Some episodes are free as a preview. Unlocking the rest requires an active VIP plan or a coin
        unlock for that episode. Preview teasers on locked episodes do not constitute a license to the
        full episode.
      </p>
      <h2>5. Acceptable use</h2>
      <ul>
        <li>Do not attempt to circumvent access controls, scrape the catalog, or reverse-engineer the player.</li>
        <li>Do not upload malware, harass staff, or impersonate others.</li>
        <li>Do not use the service for any unlawful purpose.</li>
      </ul>
      <h2>6. Content and availability</h2>
      <p>
        Stories on {siteConfig.name} are original fiction. Catalog, artwork, and episode availability may
        change. We try to keep the service reliable but do not guarantee uninterrupted streaming.
      </p>
      <h2>7. Disclaimers and liability</h2>
      <p>
        The service is provided “as is.” To the fullest extent permitted by law, {siteConfig.name} is not
        liable for indirect or consequential damages, and our total liability is limited to the amount you
        paid us in the three months before the claim.
      </p>
      <h2>8. Changes</h2>
      <p>
        We may update these terms. Material changes will be posted on this page with a new “last updated”
        date. Continued use after that date means you accept the revised terms.
      </p>
    </LegalShell>
  );
}
